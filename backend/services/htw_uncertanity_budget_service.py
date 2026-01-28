from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, asc
from fastapi import HTTPException
from decimal import Decimal, ROUND_HALF_UP
import math
from backend.models import (
    HTWJob, 
    HTWRepeatability, 
    HTWUncertaintyBudget, 
    HTWUnPGMaster,
    HTWStandardUncertaintyReference,
    HTWReproducibility,
    HTWOutputDriveVariation,
    HTWDriveInterfaceVariation,
    HTWLoadingPointVariation,
    HTWUnResolution,
    HTWTDistribution,
    HTWMaxValMeasureErr,
    HTWCMCReference
)

class UncertaintyService:

    @staticmethod
    def get_budget_by_equipment(db: Session, inward_eqp_id: int):
        """
        Fetches ALL Uncertainty Budget steps for the most recent job.
        Returns a list of budget objects sorted by step_percent (ascending).
        """
        # 1. Find the latest Job for this equipment
        job = db.query(HTWJob).filter(
            HTWJob.inward_eqp_id == inward_eqp_id
        ).order_by(HTWJob.job_id.desc()).first()

        if not job:
            return []

        # 2. Find ALL Budget steps for this Job
        # Ordered by step_percent ASC (e.g., 10, 20 ... 100)
        budgets = db.query(HTWUncertaintyBudget).filter(
            HTWUncertaintyBudget.job_id == job.job_id
        ).order_by(asc(HTWUncertaintyBudget.step_percent)).all()

        return budgets
    
    @staticmethod
    def calculate_uncertainty_budget(db: Session, inward_id: int, inward_eqp_id: int):
        """
        Calculates all uncertainty components and saves to DB.
        """
        
        job = db.query(HTWJob).filter(
            HTWJob.inward_id == inward_id,
            HTWJob.inward_eqp_id == inward_eqp_id
        ).first()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if job.res_pressure is None:
             raise HTTPException(status_code=400, detail="Job resolution (resolution_pressure_gauge) is missing.")

        repeatability_records = db.query(HTWRepeatability).filter(
            HTWRepeatability.job_id == job.job_id
        ).all()

        if not repeatability_records:
            raise HTTPException(status_code=404, detail="No repeatability records found. Please complete the Repeatability step first.")

        step_100_record = next((r for r in repeatability_records if r.step_percent == 100), None)
        if not step_100_record or not step_100_record.set_torque_ts or not step_100_record.set_pressure_ps:
            # Fallback: try to find the max step if 100 isn't explicitly labeled
            step_100_record = max(repeatability_records, key=lambda x: x.step_percent)
            if not step_100_record:
                raise HTTPException(status_code=400, detail="100% Step data (Ts/Ps) missing.")

        # --- PHASE 2: Pre-Calculation of Constants ---
        ts_100 = Decimal(step_100_record.set_torque_ts)
        ps_100 = Decimal(step_100_record.set_pressure_ps)
        res_pressure = Decimal(job.res_pressure)
        sqrt_3 = Decimal(math.sqrt(3))
        sqrt_5 = Decimal(math.sqrt(5))
        
        try:
            torque_pressure_ratio = ts_100 / ps_100
        except ZeroDivisionError:
             raise HTTPException(status_code=400, detail="Ps at 100% is zero. Cannot calculate ratio.")

        # Constants
        delta_p_constant = res_pressure / (Decimal(10) * sqrt_3)
        wr_constant = (res_pressure * Decimal("0.5")) / sqrt_3

        # Variation Constants (Fetch once)
        repro_record = db.query(HTWReproducibility).filter(
            HTWReproducibility.job_id == job.job_id,
            HTWReproducibility.error_due_to_reproducibility.isnot(None)
        ).order_by(desc(HTWReproducibility.set_torque_ts)).first()
        wrep_constant_part = (Decimal(repro_record.error_due_to_reproducibility) * Decimal("0.5") / sqrt_3) if repro_record else Decimal(0)

        od_record = db.query(HTWOutputDriveVariation).filter(
            HTWOutputDriveVariation.job_id == job.job_id,
            HTWOutputDriveVariation.error_due_output_drive_bout.isnot(None)
        ).first()
        wod_constant_part = (Decimal(od_record.error_due_output_drive_bout) * Decimal("0.5") / sqrt_3) if od_record else Decimal(0)

        int_record = db.query(HTWDriveInterfaceVariation).filter(
            HTWDriveInterfaceVariation.job_id == job.job_id,
            HTWDriveInterfaceVariation.error_due_drive_interface_bint.isnot(None)
        ).first()
        wint_constant_part = (Decimal(int_record.error_due_drive_interface_bint) * Decimal("0.5") / sqrt_3) if int_record else Decimal(0)

        load_record = db.query(HTWLoadingPointVariation).filter(
            HTWLoadingPointVariation.job_id == job.job_id,
            HTWLoadingPointVariation.error_due_loading_point_bl.isnot(None)
        ).first()
        wl_constant_part = (Decimal(load_record.error_due_loading_point_bl) * Decimal("0.5") / sqrt_3) if load_record else Decimal(0)

        # Map Data from UnResolution Table
        un_resolution_records = db.query(HTWUnResolution).filter(HTWUnResolution.job_id == job.job_id).all()
        
        b_re_map = {rec.step_percent: Decimal(rec.variation_due_to_repeatability) for rec in un_resolution_records if rec.variation_due_to_repeatability is not None}
        as_map = {rec.step_percent: Decimal(rec.a_s) for rec in un_resolution_records if rec.a_s is not None}

        calculated_count = 0

        # --- PHASE 3: Step-by-Step Calculation Loop ---
        for record in repeatability_records:
            # Skip invalid records
            if not record.set_pressure_ps or not record.set_torque_ts: continue 
            
            current_ps = Decimal(record.set_pressure_ps)
            current_ts_x = Decimal(record.set_torque_ts)
            
            if current_ts_x == 0: continue 

            if record.corrected_mean is None:
                # If Corrected Mean is missing, we can't calculate relative uncertainty
                continue

            corrected_mean = Decimal(record.corrected_mean)
            if corrected_mean == 0:
                 continue
            
            term_100_over_mean = Decimal(100) / corrected_mean

            # 1. δS_un (Pressure Gauge)
            # Find active master PG where current_ps is within range
            master_pg = db.query(HTWUnPGMaster).filter(
                and_(
                    HTWUnPGMaster.set_pressure_min <= current_ps, 
                    HTWUnPGMaster.set_pressure_max >= current_ps, 
                    HTWUnPGMaster.is_active == True
                )
            ).first()
            
            # Default to 0.1% if not found to prevent crash, or raise error
            uncert_percent = Decimal(master_pg.uncertainty_percent) if master_pg else Decimal("0.1") 
            
            delta_s_un_val = ((uncert_percent / Decimal(2)) * torque_pressure_ratio / current_ts_x).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

            # 2. δP
            delta_p_val = (delta_p_constant * torque_pressure_ratio * (Decimal(100) / current_ts_x)).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

            # 3. Wmd
            wmd_ref = db.query(HTWStandardUncertaintyReference).filter(
                HTWStandardUncertaintyReference.is_active == True, 
                HTWStandardUncertaintyReference.indicated_torque >= current_ts_x
            ).order_by(asc(HTWStandardUncertaintyReference.indicated_torque)).first()
            
            if not wmd_ref:
                # Fallback to largest available
                wmd_ref = db.query(HTWStandardUncertaintyReference).filter(HTWStandardUncertaintyReference.is_active == True).order_by(desc(HTWStandardUncertaintyReference.indicated_torque)).first()
            
            wmd_percent = Decimal(wmd_ref.uncertainty_percent) if wmd_ref else Decimal("1.0")
            wmd_val = (wmd_percent / Decimal(2)).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

            # 4. Wr
            wr_val = (wr_constant * term_100_over_mean).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

            # 5-8. Variations
            wrep_val = (wrep_constant_part * term_100_over_mean).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP) if wrep_constant_part > 0 else Decimal(0)
            wod_val = (wod_constant_part * term_100_over_mean).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP) if wod_constant_part > 0 else Decimal(0)
            wint_val = (wint_constant_part * term_100_over_mean).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP) if wint_constant_part > 0 else Decimal(0)
            wl_val = (wl_constant_part * term_100_over_mean).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP) if wl_constant_part > 0 else Decimal(0)

            # 9. Wre (Type A Repeatability)
            b_re = b_re_map.get(record.step_percent, Decimal(0))
            wre_val = ( (b_re / sqrt_5) * term_100_over_mean ).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP) if b_re > 0 else Decimal(0)

            # 10. Combined Uncertainty (W)
            sum_of_squares = (
                (wre_val ** 2) + ((Decimal(2) * wr_val) ** 2) + (wod_val ** 2) + 
                (delta_s_un_val ** 2) + (delta_p_val ** 2) + (wint_val ** 2) + 
                (wmd_val ** 2) + (wl_val ** 2) + (wrep_val ** 2)
            )
            combined_uncertainty_val = sum_of_squares.sqrt().quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

            # 11. Effective Degree of Freedom (Veff)
            effective_dof_val = None
            if wre_val > 0:
                numerator = (combined_uncertainty_val ** 4) * Decimal(4)
                denominator = wre_val ** 4
                if denominator > 0:
                    dof_raw = numerator / denominator
                    effective_dof_val = dof_raw.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

            # 12. Coverage Factor (k)
            coverage_factor_val = Decimal("2.000")
            if effective_dof_val is not None:
                dof_int = int(effective_dof_val)
                t_record = db.query(HTWTDistribution).filter(
                    HTWTDistribution.degrees_of_freedom == dof_int,
                    HTWTDistribution.alpha == Decimal("0.0455")
                ).first()
                if t_record:
                    coverage_factor_val = t_record.t_value
            # If Veff is infinite or huge, k=2.000 is standard

            # 13. Expanded Uncertainty (U)
            expanded_uncertainty_val = (coverage_factor_val * combined_uncertainty_val).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # 14. Expanded Uncertainty in Nm
            expanded_un_nm_val = ((expanded_uncertainty_val * current_ts_x) / Decimal(100)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

            # 15. Mean Measurement Error
            raw_as = as_map.get(record.step_percent, Decimal(0))
            mean_measurement_error_val = abs(raw_as).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

            # 16. Max Device Error
            max_err_record = db.query(HTWMaxValMeasureErr).filter(
                and_(
                    HTWMaxValMeasureErr.range_min <= current_ts_x,
                    HTWMaxValMeasureErr.range_max >= current_ts_x,
                    HTWMaxValMeasureErr.is_active == True
                )
            ).first()
            
            # Default 1.0% if not found
            max_device_error_val = Decimal(max_err_record.un_percent) if max_err_record else Decimal("1.0")

            # 17. CMC
            cmc_record = db.query(HTWCMCReference).filter(
                and_(
                    HTWCMCReference.lower_measure_range <= current_ts_x,
                    HTWCMCReference.higher_measure_range > current_ts_x,
                    HTWCMCReference.is_active == True
                )
            ).first()
            
            # Default CMC 0.5% if not found
            cmc_percent = Decimal(cmc_record.cmc_percent) if cmc_record else Decimal("0.5")
            cmc_val = (cmc_percent * current_ts_x / Decimal(100)).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

            # 18. CMC of Reading %
            cmc_of_reading_val = ((cmc_val / current_ts_x) * Decimal(100)).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

            # 19. Final Wl - FR-46 Decision Rule
            # Formula: max_device_error + mean_measurement_error + MAX(expanded_uncertainty, cmc_of_reading)
            max_uncertainty_comp = max(expanded_uncertainty_val, cmc_of_reading_val)
            final_wl_val = (max_device_error_val + mean_measurement_error_val + max_uncertainty_comp).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)


            # --- PHASE 4: Database Update ---
            budget_entry = db.query(HTWUncertaintyBudget).filter(
                HTWUncertaintyBudget.job_id == job.job_id,
                HTWUncertaintyBudget.step_percent == record.step_percent
            ).first()

            if budget_entry:
                budget_entry.set_torque_ts = record.set_torque_ts
                budget_entry.delta_s_un = delta_s_un_val
                budget_entry.delta_p = delta_p_val
                budget_entry.wmd = wmd_val
                budget_entry.wr = wr_val
                budget_entry.wrep = wrep_val
                budget_entry.wod = wod_val
                budget_entry.wint = wint_val
                budget_entry.wl = wl_val
                budget_entry.wre = wre_val
                budget_entry.combined_uncertainty = combined_uncertainty_val
                budget_entry.effective_dof = effective_dof_val
                budget_entry.coverage_factor = coverage_factor_val
                budget_entry.expanded_uncertainty = expanded_uncertainty_val
                budget_entry.expanded_un_nm = expanded_un_nm_val
                budget_entry.mean_measurement_error = mean_measurement_error_val
                budget_entry.max_device_error = max_device_error_val
                budget_entry.cmc = cmc_val
                budget_entry.cmc_of_reading = cmc_of_reading_val
                budget_entry.final_wl = final_wl_val
            else:
                new_budget = HTWUncertaintyBudget(
                    job_id=job.job_id,
                    step_percent=record.step_percent,
                    set_torque_ts=record.set_torque_ts,
                    delta_s_un=delta_s_un_val,
                    delta_p=delta_p_val,
                    wmd=wmd_val,
                    wr=wr_val,
                    wrep=wrep_val,
                    wod=wod_val,
                    wint=wint_val,
                    wl=wl_val,
                    wre=wre_val,
                    combined_uncertainty=combined_uncertainty_val,
                    effective_dof=effective_dof_val,
                    coverage_factor=coverage_factor_val,
                    expanded_uncertainty=expanded_uncertainty_val,
                    expanded_un_nm=expanded_un_nm_val,
                    mean_measurement_error=mean_measurement_error_val,
                    max_device_error=max_device_error_val,
                    cmc=cmc_val,
                    cmc_of_reading=cmc_of_reading_val,
                    final_wl=final_wl_val
                )
                db.add(new_budget)
            
            calculated_count += 1

        db.commit()
        return {"job_id": job.job_id, "count": calculated_count}