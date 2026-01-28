# This file ensures that all models are imported when the 'models' package is used.

from .users import User
from .customers import Customer
from .inward import Inward

# ... import all your other model classes here ...
from .alembic_versions import AlembicVersion
from .invitations import Invitation
from .notifications import Notification
from .srfs import Srf
from .srf_equipments import SrfEquipment
from .password_reset_token import PasswordResetToken
from .refresh_token import RefreshToken
from .delayed_email_tasks import DelayedEmailTask
from .inward_equipments import InwardEquipment
from .htw_master_standard import HTWMasterStandard
from .htw_manufacturer_spec import HTWManufacturerSpec
from .htw_pressure_gauge_resolution import HTWPressureGaugeResolution
from .htw_nomenclature_range import HTWNomenclatureRange
from .htw_job import HTWJob
from .htw_standard_uncertainty_reference import HTWStandardUncertaintyReference
from .htw_repeatability import HTWRepeatability
from .htw_repetability_reading import HTWRepeatabilityReading
from .htw_reproducibility import HTWReproducibility
from .htw_reproducibility_reading import HTWReproducibilityReading
from .htw_drive_interface_variation import HTWDriveInterfaceVariation
from .htw_drive_interface_variation_reading import HTWDriveInterfaceVariationReading
from .htw_loading_point_variation import HTWLoadingPointVariation
from .htw_loading_point_variation_reading import HTWLoadingPointVariationReading
from .htw_output_drive_variation import HTWOutputDriveVariation
from .htw_output_drive_variation_reading import HTWOutputDriveVariationReading
from .htw_job_environment import HTWJobEnvironment
from .htw_un_resolution import HTWUnResolution
from .htw_uncertainty_budget import HTWUncertaintyBudget
from .htw_un_pg_master import HTWUnPGMaster
from .htw_t_distribution import HTWTDistribution
from .htw_max_val_measure_err import HTWMaxValMeasureErr
from .htw_cmc_reference import HTWCMCReference

from backend.db import Base