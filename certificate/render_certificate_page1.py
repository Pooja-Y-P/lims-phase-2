"""
Standalone render script for Certificate Page 1
Can be imported and used in other projects
"""

from jinja2 import Environment, FileSystemLoader
import os
from pathlib import Path
import requests
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, date
import math


def render_certificate_page1(data, output_path=None, template_dir=None):
    """
    Render certificate page 1 HTML from template and data.
    
    Args:
        data (dict): Dictionary containing certificate data fields
        output_path (str, optional): Path to save rendered HTML. If None, returns HTML string
        template_dir (str, optional): Directory containing templates. Defaults to current directory
    
    Returns:
        str: Rendered HTML string if output_path is None, otherwise None
    
    Example data structure:
        {
            'certificate_code': 'CC-4466',
            'certificate_no': 'NEPL / C / 25200-4',
            'calibration_date': '05-12-2025',
            'nepl_id': '25200-4',
            'cal_due_date': '04-12-2026',
            'ulr_no': 'CC446625000001731F',
            'issue_date': '26-12-2025',
            'field_of_parameter': 'Torque',
            'customer_name': 'Customer Name',
            'customer_address': 'Customer Address',
            'reference_dc_no': '',
            'reference_no_date': '',
            'receipt_date': '',
            'item_status': '',
            'device_nomenclature': 'Hydraulic torque wrench',
            'device_make_model': 'Enerpac / RSQ3000ST',
            'device_type': 'Indicating',
            'units_of_measurement': '',
            'calibration_mode': '',
            'place_of_calibration': '',
            'si_no': 'E23A1157 / E24A1777',
            'pressure_gauge_resolution': '0.1',
            'torque_range': '393-4176',
            'calibration_procedure': 'Done as per NEPL Ref: CP .No 02...',
            'standard1_nomenclature': 'TORQUE TRANSDUCER (100 - 1500 Nm)',
            'standard1_manufacturer': 'NORBAR, UK',
            'standard1_model': '50676.LOG/169590/148577',
            'standard1_uncertainty': '0.15%',
            'standard1_cert_no': 'SCPL/CC/1289/07/2024-2025',
            'standard1_valid_upto': '25-07-2026',
            'standard1_traceability': 'Traceable to NABL Accredited Lab No. CC 2874',
            'standard2_nomenclature': 'TORQUE TRANSDUCER (1000 - 40000 Nm)',
            'standard2_manufacturer': 'NORBAR, UK',
            'standard2_model': '50781.LOG / 201062 / 148577',
            'standard2_uncertainty': '0.16%',
            'standard2_cert_no': 'SCPL/CC/3685/03/2023-2024',
            'standard2_valid_upto': '13.03.2026',
            'standard2_traceability': 'Traceable to NABL Accredited Lab No. CC 2874',
            'standard3_nomenclature': 'DIGITAL PRESSURE GAUGE 1000 bar',
            'standard3_manufacturer': 'MASS',
            'standard3_model': 'MG301/ 25.CJ.017',
            'standard3_uncertainty': '0.39%',
            'standard3_cert_no': 'NEPL / C / 2025 / 98-9',
            'standard3_valid_upto': '25-03-2026',
            'standard3_traceability': 'Traceable to NABL Accredited Lab No. CC-3217',
            'temperature': '23.1',
            'humidity': '62',
            'authorised_signatory': 'Ramesh Ramakrishna',
            'logo_left': 'path/to/logo_left.png',  # Optional
            'logo_right': 'path/to/logo_right.png',  # Optional
            'qr_code': 'path/to/qr_code.png',  # Optional
        }
    """
    # Determine template directory
    if template_dir is None:
        # Use the directory where this script is located
        template_dir = Path(__file__).parent
    else:
        template_dir = Path(template_dir)
    
    # Set up Jinja environment
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    
    # Load template
    template = env.get_template('certificate_page1.html')
    
    # Render template with data
    html = template.render(**data)
    
    # Save to file if output_path is provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        return None
    
    # Return HTML string
    return html


def render_certificate_page2(data, output_path=None, template_dir=None):
    """
    Render certificate page 2 HTML from template and data.
    
    Args:
        data (dict): Dictionary containing certificate data fields
        output_path (str, optional): Path to save rendered HTML. If None, returns HTML string
        template_dir (str, optional): Directory containing templates. Defaults to current directory
    
    Returns:
        str: Rendered HTML string if output_path is None, otherwise None
    """
    # Determine template directory
    if template_dir is None:
        template_dir = Path(__file__).parent
    else:
        template_dir = Path(template_dir)
    
    # Set up Jinja environment
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    
    # Load template
    template = env.get_template('certificate_page2.html')
    
    # Render template with data
    html = template.render(**data)
    
    # Save to file if output_path is provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        return None
    
    # Return HTML string
    return html


def render_certificate_page3(data, output_path=None, template_dir=None):
    """
    Render certificate page 3 HTML from template and data.
    
    Args:
        data (dict): Dictionary containing certificate data fields
        output_path (str, optional): Path to save rendered HTML. If None, returns HTML string
        template_dir (str, optional): Directory containing templates. Defaults to current directory
    
    Returns:
        str: Rendered HTML string if output_path is None, otherwise None
    """
    # Determine template directory
    if template_dir is None:
        template_dir = Path(__file__).parent
    else:
        template_dir = Path(template_dir)
    
    # Set up Jinja environment
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    
    # Load template
    template = env.get_template('certificate_page3.html')
    
    # Render template with data
    html = template.render(**data)
    
    # Save to file if output_path is provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        return None
    
    # Return HTML string
    return html


def render_certificate_combined(data, output_path=None, template_dir=None):
    """
    Render combined certificate (all 3 pages) HTML from template and data.
    
    Args:
        data (dict): Dictionary containing certificate data fields
        output_path (str, optional): Path to save rendered HTML. If None, returns HTML string
        template_dir (str, optional): Directory containing templates. Defaults to current directory
    
    Returns:
        str: Rendered HTML string if output_path is None, otherwise None
    """
    # Determine template directory
    if template_dir is None:
        template_dir = Path(__file__).parent
    else:
        template_dir = Path(template_dir)
    
    # Set up Jinja environment
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    
    # Load template
    template = env.get_template('certificate_combined.html')
    
    # Render template with data
    html = template.render(**data)
    
    # Save to file if output_path is provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        return None
    
    # Return HTML string
    return html


def fetch_inward_data(inward_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[Dict[str, Any]]:
    """
    Fetch full inward data from the API endpoint including customer and equipment data.
    
    Args:
        inward_id: The inward ID to fetch data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        Dictionary containing full inward data with customer and equipment, or None if fetch fails
    """
    try:
        url = f"{api_base_url}/staff/inwards/{inward_id}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data
    except Exception as e:
        print(f"Error fetching inward data: {e}")
        return None


def fetch_inward_equipment(inward_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[Dict[str, Any]]:
    """
    Fetch inward equipment data from the API endpoint.
    
    Args:
        inward_id: The inward ID to fetch equipment data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        Dictionary containing equipment data, or None if fetch fails
    """
    inward_data = fetch_inward_data(inward_id, api_base_url)
    if inward_data and inward_data.get('equipments') and len(inward_data['equipments']) > 0:
        equipment = inward_data['equipments'][0]  # Use first equipment
        return equipment
    return None


def fetch_job_id_from_inward_eqp_id(inward_eqp_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[int]:
    """
    Fetch job_id from inward_eqp_id using the HTW Jobs API.
    
    Args:
        inward_eqp_id: The inward equipment ID to fetch job for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        job_id if found, None otherwise
    """
    try:
        url = f"{api_base_url}/htw-jobs/"
        params = {"inward_eqp_id": inward_eqp_id}
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        jobs = response.json()
        
        # Get first job if exists
        if jobs and len(jobs) > 0:
            return jobs[0].get('job_id')
        return None
    except Exception as e:
        print(f"Error fetching job_id from inward_eqp_id: {e}")
        return None


def fetch_standards_from_job_id(job_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[List[Dict[str, Any]]]:
    """
    Fetch standards from htw_job_standard_snapshot table using job_id.
    
    Args:
        job_id: The job ID to fetch standards for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        List of standard dictionaries ordered by standard_order, or None if fetch fails
    """
    try:
        url = f"{api_base_url}/jobs/{job_id}/auto-selected-standards"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('exists') and data.get('standards'):
            return data['standards']
        return []
    except Exception as e:
        print(f"Error fetching standards from job_id: {e}")
        return []


def map_standards_to_certificate_data(standards: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Map standards data from htw_job_standard_snapshot to certificate template fields.
    
    Args:
        standards: List of standard dictionaries from API, ordered by standard_order
    
    Returns:
        Dictionary with standard fields populated (standard1, standard2, standard3)
    """
    # Initialize all standard fields as empty
    result = {
        'standard1_nomenclature': '',
        'standard1_manufacturer': '',
        'standard1_model': '',
        'standard1_uncertainty': '',
        'standard1_cert_no': '',
        'standard1_valid_upto': '',
        'standard1_traceability': '',
        
        'standard2_nomenclature': '',
        'standard2_manufacturer': '',
        'standard2_model': '',
        'standard2_uncertainty': '',
        'standard2_cert_no': '',
        'standard2_valid_upto': '',
        'standard2_traceability': '',
        
        'standard3_nomenclature': '',
        'standard3_manufacturer': '',
        'standard3_model': '',
        'standard3_uncertainty': '',
        'standard3_cert_no': '',
        'standard3_valid_upto': '',
        'standard3_traceability': '',
    }
    
    # Map standards based on standard_order (1, 2, 3)
    for standard in standards:
        order = standard.get('standard_order', 0)
        
        if order == 1:
            result['standard1_nomenclature'] = standard.get('nomenclature', '')
            result['standard1_manufacturer'] = standard.get('manufacturer', '')
            result['standard1_model'] = standard.get('model_serial_no', '')
            
            # Format uncertainty with unit if available
            uncertainty = standard.get('uncertainty')
            uncertainty_unit = standard.get('uncertainty_unit', '')
            if uncertainty is not None:
                if uncertainty_unit:
                    result['standard1_uncertainty'] = f"{uncertainty} {uncertainty_unit}"
                else:
                    result['standard1_uncertainty'] = str(uncertainty)
            
            result['standard1_cert_no'] = standard.get('certificate_no', '')
            
            # Format date if available (convert from YYYY-MM-DD to DD-MM-YYYY)
            valid_upto = standard.get('calibration_valid_upto')
            if valid_upto:
                try:
                    if isinstance(valid_upto, str):
                        # Parse ISO format date string
                        date_obj = datetime.strptime(valid_upto, '%Y-%m-%d')
                    else:
                        date_obj = valid_upto
                    result['standard1_valid_upto'] = date_obj.strftime('%d-%m-%Y')
                except (ValueError, AttributeError):
                    result['standard1_valid_upto'] = str(valid_upto)
            
            # Traceability - get from traceable_to_lab field
            result['standard1_traceability'] = standard.get('traceable_to_lab', '')
            
        elif order == 2:
            result['standard2_nomenclature'] = standard.get('nomenclature', '')
            result['standard2_manufacturer'] = standard.get('manufacturer', '')
            result['standard2_model'] = standard.get('model_serial_no', '')
            
            uncertainty = standard.get('uncertainty')
            uncertainty_unit = standard.get('uncertainty_unit', '')
            if uncertainty is not None:
                if uncertainty_unit:
                    result['standard2_uncertainty'] = f"{uncertainty} {uncertainty_unit}"
                else:
                    result['standard2_uncertainty'] = str(uncertainty)
            
            result['standard2_cert_no'] = standard.get('certificate_no', '')
            
            # Format date if available (convert from YYYY-MM-DD to DD-MM-YYYY)
            valid_upto = standard.get('calibration_valid_upto')
            if valid_upto:
                try:
                    if isinstance(valid_upto, str):
                        date_obj = datetime.strptime(valid_upto, '%Y-%m-%d')
                    else:
                        date_obj = valid_upto
                    result['standard2_valid_upto'] = date_obj.strftime('%d-%m-%Y')
                except (ValueError, AttributeError):
                    result['standard2_valid_upto'] = str(valid_upto)
            
            # Traceability - get from traceable_to_lab field
            result['standard2_traceability'] = standard.get('traceable_to_lab', '')
            
        elif order == 3:
            result['standard3_nomenclature'] = standard.get('nomenclature', '')
            result['standard3_manufacturer'] = standard.get('manufacturer', '')
            result['standard3_model'] = standard.get('model_serial_no', '')
            
            uncertainty = standard.get('uncertainty')
            uncertainty_unit = standard.get('uncertainty_unit', '')
            if uncertainty is not None:
                if uncertainty_unit:
                    result['standard3_uncertainty'] = f"{uncertainty} {uncertainty_unit}"
                else:
                    result['standard3_uncertainty'] = str(uncertainty)
            
            result['standard3_cert_no'] = standard.get('certificate_no', '')
            
            # Format date if available (convert from YYYY-MM-DD to DD-MM-YYYY)
            valid_upto = standard.get('calibration_valid_upto')
            if valid_upto:
                try:
                    if isinstance(valid_upto, str):
                        date_obj = datetime.strptime(valid_upto, '%Y-%m-%d')
                    else:
                        date_obj = valid_upto
                    result['standard3_valid_upto'] = date_obj.strftime('%d-%m-%Y')
                except (ValueError, AttributeError):
                    result['standard3_valid_upto'] = str(valid_upto)
            
            # Traceability - get from traceable_to_lab field
            result['standard3_traceability'] = standard.get('traceable_to_lab', '')
    
    return result


def map_equipment_to_certificate_data(equipment: Dict[str, Any], standards: Optional[List[Dict[str, Any]]] = None, customer: Optional[Dict[str, Any]] = None, inward_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Map inward equipment data to certificate template fields.
    Only maps device under calibration fields, keeps others empty.
    
    Args:
        equipment: Dictionary containing equipment data from API
        standards: Optional list of standards from htw_job_standard_snapshot
        customer: Optional dictionary containing customer data from API
        inward_data: Optional dictionary containing inward data from API
    
    Returns:
        Dictionary with certificate data fields
    """
    # Map equipment fields to certificate fields
    device_nomenclature = equipment.get('material_description', '')
    device_make_model = ''
    if equipment.get('make') and equipment.get('model'):
        device_make_model = f"{equipment.get('make')} / {equipment.get('model')}"
    elif equipment.get('make'):
        device_make_model = equipment.get('make')
    elif equipment.get('model'):
        device_make_model = equipment.get('model')
    
    device_type = ''  # Keep empty as requested
    si_no = equipment.get('serial_no', '')
    nepl_id = equipment.get('nepl_id', '')
    torque_range = equipment.get('range', '')
    place_of_calibration = equipment.get('calibration_by', '')
    units_of_measurement = equipment.get('unit', '')  # Map unit from inward equipment
    
    # Map customer data if provided
    customer_name = ''
    customer_address = ''
    if customer:
        customer_name = customer.get('customer_details', '')  # Company name
        customer_address = customer.get('bill_to_address', '')  # Bill to address
    
    # Map inward data for Customer Reference section
    reference_dc_no = ''
    reference_no_date = ''
    receipt_date = ''
    
    if inward_data:
        # Customer DC No from inward table
        reference_dc_no = inward_data.get('customer_dc_no', '')
        
        # Customer DC Date from inward table
        customer_dc_date = inward_data.get('customer_dc_date', '')
        if customer_dc_date:
            # Format date if it's a string or date object
            try:
                if isinstance(customer_dc_date, str):
                    # Try to parse the date string (could be in various formats)
                    # Common formats: YYYY-MM-DD, DD-MM-YYYY, etc.
                    try:
                        date_obj = datetime.strptime(customer_dc_date, '%Y-%m-%d')
                    except ValueError:
                        try:
                            date_obj = datetime.strptime(customer_dc_date, '%d-%m-%Y')
                        except ValueError:
                            # If parsing fails, use as is
                            reference_no_date = customer_dc_date
                            date_obj = None
                    if date_obj:
                        reference_no_date = date_obj.strftime('%d-%m-%Y')
                elif isinstance(customer_dc_date, date):
                    reference_no_date = customer_dc_date.strftime('%d-%m-%Y')
                else:
                    reference_no_date = str(customer_dc_date)
            except (ValueError, AttributeError):
                reference_no_date = str(customer_dc_date) if customer_dc_date else ''
    
    # Date of Receipt - today's date formatted as DD-MM-YYYY
    receipt_date = date.today().strftime('%d-%m-%Y')
    
    # Map standards if provided
    standards_data = {}
    if standards:
        standards_data = map_standards_to_certificate_data(standards)
    else:
        # Initialize empty standards
        standards_data = {
            'standard1_nomenclature': '',
            'standard1_manufacturer': '',
            'standard1_model': '',
            'standard1_uncertainty': '',
            'standard1_cert_no': '',
            'standard1_valid_upto': '',
            'standard1_traceability': '',
            'standard2_nomenclature': '',
            'standard2_manufacturer': '',
            'standard2_model': '',
            'standard2_uncertainty': '',
            'standard2_cert_no': '',
            'standard2_valid_upto': '',
            'standard2_traceability': '',
            'standard3_nomenclature': '',
            'standard3_manufacturer': '',
            'standard3_model': '',
            'standard3_uncertainty': '',
            'standard3_cert_no': '',
            'standard3_valid_upto': '',
            'standard3_traceability': '',
        }
    
    return {
        # Device Under Calibration fields - populated from equipment
        'device_nomenclature': device_nomenclature,
        'device_make_model': device_make_model,
        'device_type': device_type,
        'si_no': si_no,
        'nepl_id': nepl_id,
        'torque_range': torque_range,
        'place_of_calibration': place_of_calibration,
        
        # Keep all other fields empty as requested
        'certificate_code': '',
        'certificate_no': '',
        'calibration_date': '',
        'cal_due_date': '',
        'ulr_no': '',
        'issue_date': '',
        'field_of_parameter': '',
        'customer_name': customer_name,
        'customer_address': customer_address,
        'reference_dc_no': reference_dc_no,
        'reference_no_date': reference_no_date,
        'receipt_date': receipt_date,
        'item_status': '',
        'units_of_measurement': units_of_measurement,
        'calibration_mode': '',
        'pressure_gauge_resolution': '',
        'calibration_procedure': '',
        
        # Reference Standards - populated from htw_job_standard_snapshot
        **standards_data,
        
        'temperature': '',
        'humidity': '',
        'authorised_signatory': '',
    }


def get_certificate_data_from_inward(inward_id: int, api_base_url: str = "http://localhost:8000/api") -> Dict[str, Any]:
    """
    Fetch inward equipment data and map it to certificate template fields.
    Also fetches Reference Standard Details from htw_job_standard_snapshot table.
    Also fetches Customer Name and Address from customer table.
    
    Args:
        inward_id: The inward ID to fetch equipment data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        Dictionary with certificate data fields (device under calibration, standards, and customer populated)
    """
    # Fetch full inward data (includes customer and equipment)
    inward_data = fetch_inward_data(inward_id, api_base_url)
    
    equipment = None
    customer = None
    
    if inward_data:
        # Extract customer data
        customer = inward_data.get('customer')
        
        # Extract equipment data (use first equipment if multiple exist)
        if inward_data.get('equipments') and len(inward_data['equipments']) > 0:
            equipment = inward_data['equipments'][0]
    
    standards = None
    if equipment:
        # Get inward_eqp_id from equipment
        inward_eqp_id = equipment.get('inward_eqp_id')
        if inward_eqp_id:
            # Fetch job_id from inward_eqp_id
            job_id = fetch_job_id_from_inward_eqp_id(inward_eqp_id, api_base_url)
            if job_id:
                # Fetch standards from job_id
                standards = fetch_standards_from_job_id(job_id, api_base_url)
    
    if equipment:
        return map_equipment_to_certificate_data(equipment, standards, customer, inward_data)
    else:
        # Return empty structure if fetch fails
        return map_equipment_to_certificate_data({}, standards, customer, inward_data)


def fetch_repeatability_from_job_id(job_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[List[Dict[str, Any]]]:
    """
    Fetch repeatability data from htw_repeatability and htw_repeatability_readings tables using job_id.
    
    Args:
        job_id: The job ID to fetch repeatability data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        List of repeatability dictionaries, or None if fetch fails
    """
    try:
        url = f"{api_base_url}/htw-calculations/repeatability/{job_id}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') == 'success' and data.get('results'):
            return data['results']
        return []
    except Exception as e:
        print(f"Error fetching repeatability from job_id: {e}")
        return []


def calculate_repeatability_error(readings: List[float]) -> Tuple[float, float]:
    """
    Calculate repeatability error (b_re) as standard deviation of readings.
    
    Args:
        readings: List of reading values
    
    Returns:
        Tuple of (repeatability_error_nm, repeatability_error_pct)
    """
    if not readings or len(readings) < 2:
        return (0.0, 0.0)
    
    # Calculate mean
    mean = sum(readings) / len(readings)
    
    # Calculate standard deviation
    variance = sum((x - mean) ** 2 for x in readings) / len(readings)
    std_dev = math.sqrt(variance)
    
    # Repeatability error percentage (relative to mean)
    if mean != 0:
        repeatability_pct = (std_dev / mean) * 100
    else:
        repeatability_pct = 0.0
    
    return (round(std_dev, 2), round(repeatability_pct, 2))


def map_repeatability_to_certificate_data(repeatability_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Map repeatability data from API to certificate template format.
    
    Args:
        repeatability_results: List of repeatability result dictionaries from API
    
    Returns:
        List of dictionaries formatted for certificate template
    """
    certificate_data = []
    
    for result in repeatability_results:
        # Get readings (Reference Values Xr)
        readings = result.get('stored_readings', [])
        if not readings:
            continue
        
        # Convert readings to float
        readings_float = [float(r) for r in readings if r is not None]
        if not readings_float:
            continue
        
        # Get set pressure and target value (set_torque is the target Xa)
        set_pressure = result.get('set_pressure', 0.0)
        target_value = result.get('set_torque', 0.0)  # This is Xa (Target Value)
        
        # Calculate repeatability error
        repeatability_nm, repeatability_pct = calculate_repeatability_error(readings_float)
        
        certificate_data.append({
            'pressure': round(float(set_pressure), 2) if set_pressure else 0.0,
            'target': round(float(target_value), 0) if target_value else 0.0,
            'readings': readings_float,  # Reference Values Xr
            'repeatability': repeatability_nm,  # Repeatability error in Nm
            'repeatability_pct': repeatability_pct  # Repeatability error in %
        })
    
    # Sort by pressure
    certificate_data.sort(key=lambda x: x['pressure'])
    
    return certificate_data


def fetch_reproducibility_from_job_id(job_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[Dict[str, Any]]:
    """
    Fetch reproducibility data from htw_reproducibility and htw_reproducibility_reading tables using job_id.
    
    Args:
        job_id: The job ID to fetch reproducibility data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        Dictionary containing reproducibility data, or None if fetch fails
    """
    try:
        url = f"{api_base_url}/htw-calculations/reproducibility/{job_id}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') == 'success':
            return data
        return None
    except Exception as e:
        print(f"Error fetching reproducibility from job_id: {e}")
        return None


def map_reproducibility_to_certificate_data(reproducibility_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Map reproducibility data from API to certificate template format.
    
    Args:
        reproducibility_data: Dictionary containing reproducibility data from API
    
    Returns:
        List of dictionaries formatted for certificate template
    """
    certificate_data = []
    
    # Get target value (set_torque_20)
    target_value = reproducibility_data.get('set_torque_20', 0.0)
    target_float = float(target_value) if target_value else 0.0
    
    # Get reproducibility error (b_rep)
    error_nm = reproducibility_data.get('error_due_to_reproducibility', 0.0)
    error_nm_float = float(error_nm) if error_nm else 0.0
    
    # Calculate error percentage
    if target_float != 0:
        error_pct = (error_nm_float / target_float) * 100
    else:
        error_pct = 0.0
    
    # Get sequences
    sequences = reproducibility_data.get('sequences', [])
    
    # Map sequences to series1-4 based on sequence_no
    series_map = {}
    for seq in sequences:
        seq_no = seq.get('sequence_no', 0)
        mean_xr = seq.get('mean_xr', 0.0)
        series_map[seq_no] = float(mean_xr) if mean_xr else 0.0
    
    # Create certificate data entry
    certificate_data.append({
        'target': round(target_float, 0) if target_float else 0.0,
        'series1': round(series_map.get(1, 0.0), 2),
        'series2': round(series_map.get(2, 0.0), 2),
        'series3': round(series_map.get(3, 0.0), 2),
        'series4': round(series_map.get(4, 0.0), 2),
        'error': round(error_nm_float, 2),
        'error_pct': round(error_pct, 2)
    })
    
    return certificate_data


def fetch_output_drive_from_job_id(job_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[Dict[str, Any]]:
    """
    Fetch output drive variation data from htw_output_drive_variation and htw_output_drive_variation_reading tables using job_id.
    
    Args:
        job_id: The job ID to fetch output drive variation data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        Dictionary containing output drive variation data, or None if fetch fails
    """
    try:
        url = f"{api_base_url}/htw-calculations/output-drive/{job_id}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') == 'success':
            return data
        return None
    except Exception as e:
        print(f"Error fetching output drive variation from job_id: {e}")
        return None


def map_output_drive_to_certificate_data(output_drive_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Map output drive variation data from API to certificate template format.
    
    Args:
        output_drive_data: Dictionary containing output drive variation data from API
    
    Returns:
        List of dictionaries formatted for certificate template
    """
    certificate_data = []
    
    # Get target value (set_torque)
    target_value = output_drive_data.get('set_torque', 0.0)
    target_float = float(target_value) if target_value else 0.0
    
    # Get error value (b_od)
    error_nm = output_drive_data.get('error_value', 0.0)
    error_nm_float = float(error_nm) if error_nm else 0.0
    
    # Calculate error percentage
    if target_float != 0:
        error_pct = (error_nm_float / target_float) * 100
    else:
        error_pct = 0.0
    
    # Get positions
    positions = output_drive_data.get('positions', [])
    
    # Map positions to pos0, pos90, pos180, pos270 based on position_deg
    position_map = {}
    for pos in positions:
        pos_deg = pos.get('position_deg', 0)
        mean_val = pos.get('mean_value', 0.0)
        position_map[pos_deg] = float(mean_val) if mean_val else 0.0
    
    # Create certificate data entry
    certificate_data.append({
        'target': round(target_float, 0) if target_float else 0.0,
        'pos0': round(position_map.get(0, 0.0), 2),
        'pos90': round(position_map.get(90, 0.0), 2),
        'pos180': round(position_map.get(180, 0.0), 2),
        'pos270': round(position_map.get(270, 0.0), 2),
        'error': round(error_nm_float, 2),
        'error_pct': round(error_pct, 2)
    })
    
    return certificate_data


def fetch_drive_interface_from_job_id(job_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[Dict[str, Any]]:
    """
    Fetch drive interface variation data from htw_drive_interface_variation and htw_drive_interface_variation_reading tables using job_id.
    
    Args:
        job_id: The job ID to fetch drive interface variation data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        Dictionary containing drive interface variation data, or None if fetch fails
    """
    try:
        url = f"{api_base_url}/htw-calculations/drive-interface/{job_id}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') == 'success':
            return data
        return None
    except Exception as e:
        print(f"Error fetching drive interface variation from job_id: {e}")
        return None


def map_drive_interface_to_certificate_data(drive_interface_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Map drive interface variation data from API to certificate template format.
    Template expects series1-4 format (positions mapped to series).
    
    Args:
        drive_interface_data: Dictionary containing drive interface variation data from API
    
    Returns:
        List of dictionaries formatted for certificate template
    """
    certificate_data = []
    
    # Get target value (set_torque)
    target_value = drive_interface_data.get('set_torque', 0.0)
    target_float = float(target_value) if target_value else 0.0
    
    # Get error value (b_int) - API returns 'error_value'
    error_nm = drive_interface_data.get('error_value', 0.0)
    error_nm_float = float(error_nm) if error_nm else 0.0
    
    # Debug: Print if error is 0 to help diagnose
    if error_nm_float == 0.0:
        print(f"Warning: Drive interface error_value is 0. Data keys: {list(drive_interface_data.keys())}")
    
    # Calculate error percentage
    if target_float != 0:
        error_pct = (error_nm_float / target_float) * 100
    else:
        error_pct = 0.0
    
    # Get positions and map to series1-4
    positions = drive_interface_data.get('positions', [])
    
    # Map positions to series based on position_deg (0°→series1, 90°→series2, 180°→series3, 270°→series4)
    position_map = {}
    means = []
    for pos in positions:
        pos_deg = pos.get('position_deg', 0)
        mean_val = pos.get('mean_value', 0.0)
        mean_float = float(mean_val) if mean_val else 0.0
        position_map[pos_deg] = mean_float
        if mean_float != 0.0:  # Only add non-zero means
            means.append(mean_float)
    
    # If error_value is 0 but we have means, calculate it ourselves: b_int = max(means) - min(means)
    if error_nm_float == 0.0 and means:
        error_nm_float = max(means) - min(means)
        print(f"Calculated drive interface error from positions: {error_nm_float} (means: {means})")
    elif error_nm_float == 0.0:
        print(f"Warning: Drive interface error_value is 0 and no valid means found. Positions: {positions}")
    
    # Create certificate data entry
    certificate_data.append({
        'target': round(target_float, 0) if target_float else 0.0,
        'series1': round(position_map.get(0, 0.0), 2),    # Position 0° → Series 1
        'series2': round(position_map.get(90, 0.0), 2),   # Position 90° → Series 2
        'series3': round(position_map.get(180, 0.0), 2),  # Position 180° → Series 3
        'series4': round(position_map.get(270, 0.0), 2),  # Position 270° → Series 4
        'error': round(error_nm_float, 2),
        'error_pct': round(error_pct, 2)
    })
    
    return certificate_data


def fetch_loading_point_from_job_id(job_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[Dict[str, Any]]:
    """
    Fetch loading point variation data from htw_loading_point_variation and htw_loading_point_variation_reading tables using job_id.
    
    Args:
        job_id: The job ID to fetch loading point variation data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        Dictionary containing loading point variation data, or None if fetch fails
    """
    try:
        url = f"{api_base_url}/htw-calculations/loading-point/{job_id}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') == 'success':
            return data
        return None
    except Exception as e:
        print(f"Error fetching loading point variation from job_id: {e}")
        return None


def map_loading_point_to_certificate_data(loading_point_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Map loading point variation data from API to certificate template format.
    
    Args:
        loading_point_data: Dictionary containing loading point variation data from API
    
    Returns:
        List of dictionaries formatted for certificate template
    """
    certificate_data = []
    
    # Get target value (set_torque)
    target_value = loading_point_data.get('set_torque', 0.0)
    target_float = float(target_value) if target_value else 0.0
    
    # Get error value (b_l) - API returns 'error_due_to_loading_point'
    error_nm = loading_point_data.get('error_due_to_loading_point') or loading_point_data.get('error_value', 0.0)
    error_nm_float = float(error_nm) if error_nm else 0.0
    
    # Debug: Print if error is 0 to help diagnose
    if error_nm_float == 0.0:
        print(f"Warning: Loading point error is 0. Data keys: {list(loading_point_data.keys())}, error_due_to_loading_point: {loading_point_data.get('error_due_to_loading_point')}")
    
    # Calculate error percentage
    if target_float != 0:
        error_pct = (error_nm_float / target_float) * 100
    else:
        error_pct = 0.0
    
    # Get positions
    positions = loading_point_data.get('positions', [])
    
    # Map positions: -10mm → position1/mean1, +10mm → position2/mean2
    position_map = {}
    for pos in positions:
        pos_mm = pos.get('loading_position_mm', 0)
        mean_val = pos.get('mean_value', 0.0)
        position_map[pos_mm] = float(mean_val) if mean_val else 0.0
    
    # If error is 0 but we have both positions, calculate it ourselves: b_l = abs(mean(-10) - mean(+10))
    if error_nm_float == 0.0 and -10 in position_map and 10 in position_map:
        error_nm_float = abs(position_map[-10] - position_map[10])
        print(f"Calculated loading point error from positions: {error_nm_float} (mean(-10): {position_map[-10]}, mean(+10): {position_map[10]})")
    elif error_nm_float == 0.0:
        print(f"Warning: Loading point error is 0 and positions missing. Position map: {position_map}")
    
    # Create certificate data entry
    certificate_data.append({
        'torque': round(target_float, 0) if target_float else 0.0,
        'position1': '-10mm',
        'mean1': round(position_map.get(-10, 0.0), 2),
        'position2': '+10mm',
        'mean2': round(position_map.get(10, 0.0), 2),
        'error': round(error_nm_float, 2),
        'error_pct': round(error_pct, 2)
    })
    
    return certificate_data


def fetch_environment_from_job_id(job_id: int, api_base_url: str = "http://localhost:8000/api") -> Optional[Dict[str, Any]]:
    """
    Fetch environment data (PRE and POST) from htw_job_environment table using job_id.
    
    Args:
        job_id: The job ID to fetch environment data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        Dictionary containing PRE and POST environment data, or None if fetch fails
    """
    try:
        # Fetch PRE environment
        pre_url = f"{api_base_url}/staff/jobs/{job_id}/environment?condition_stage=PRE"
        pre_response = requests.get(pre_url, timeout=10)
        pre_response.raise_for_status()
        pre_data = pre_response.json()
        
        # Fetch POST environment
        post_url = f"{api_base_url}/staff/jobs/{job_id}/environment?condition_stage=POST"
        post_response = requests.get(post_url, timeout=10)
        post_response.raise_for_status()
        post_data = post_response.json()
        
        return {
            'pre': pre_data[0] if pre_data and len(pre_data) > 0 else None,
            'post': post_data[0] if post_data and len(post_data) > 0 else None
        }
    except Exception as e:
        print(f"Error fetching environment data from job_id: {e}")
        return None


def calculate_average_environment(environment_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Calculate average temperature and humidity from PRE and POST environment records.
    
    Args:
        environment_data: Dictionary containing PRE and POST environment data
    
    Returns:
        Dictionary with 'temperature' and 'humidity' as formatted strings
    """
    pre_record = environment_data.get('pre')
    post_record = environment_data.get('post')
    
    temp_pre = None
    temp_post = None
    humidity_pre = None
    humidity_post = None
    
    # Extract PRE values
    if pre_record and pre_record.get('data'):
        pre_data = pre_record['data']
        temp_pre = float(pre_data.get('ambient_temperature', 0)) if pre_data.get('ambient_temperature') else None
        humidity_pre = float(pre_data.get('relative_humidity', 0)) if pre_data.get('relative_humidity') else None
    
    # Extract POST values
    if post_record and post_record.get('data'):
        post_data = post_record['data']
        temp_post = float(post_data.get('ambient_temperature', 0)) if post_data.get('ambient_temperature') else None
        humidity_post = float(post_data.get('relative_humidity', 0)) if post_data.get('relative_humidity') else None
    
    # Calculate averages
    temperature = None
    humidity = None
    
    if temp_pre is not None and temp_post is not None:
        temperature = (temp_pre + temp_post) / 2
    elif temp_pre is not None:
        temperature = temp_pre
    elif temp_post is not None:
        temperature = temp_post
    
    if humidity_pre is not None and humidity_post is not None:
        humidity = (humidity_pre + humidity_post) / 2
    elif humidity_pre is not None:
        humidity = humidity_pre
    elif humidity_post is not None:
        humidity = humidity_post
    
    # Format as strings (temperature with 1 decimal, humidity as integer)
    return {
        'temperature': f"{temperature:.1f}" if temperature is not None else '',
        'humidity': f"{int(round(humidity))}" if humidity is not None else ''
    }


def get_certificate_data_from_inward(inward_id: int, api_base_url: str = "http://localhost:8000/api") -> Dict[str, Any]:
    """
    Fetch inward equipment data and map it to certificate template fields.
    Also fetches Reference Standard Details from htw_job_standard_snapshot table.
    Also fetches Customer Name and Address from customer table.
    Also fetches Repeatability data from htw_repeatability tables.
    Also fetches Reproducibility data from htw_reproducibility tables.
    Also fetches Output Drive Variation data from htw_output_drive_variation tables.
    Also fetches Drive Interface Variation data from htw_drive_interface_variation tables.
    Also fetches Loading Point Variation data from htw_loading_point_variation tables.
    Also fetches Environment data (PRE and POST) from htw_job_environment table and calculates averages.
    
    Args:
        inward_id: The inward ID to fetch equipment data for
        api_base_url: Base URL for the API (default: http://localhost:8000/api)
    
    Returns:
        Dictionary with certificate data fields (device under calibration, standards, customer, repeatability, reproducibility, geometric, interface, loading, and environment data populated)
    """
    # Fetch full inward data (includes customer and equipment)
    inward_data = fetch_inward_data(inward_id, api_base_url)
    
    equipment = None
    customer = None
    
    if inward_data:
        # Extract customer data
        customer = inward_data.get('customer')
        
        # Extract equipment data (use first equipment if multiple exist)
        if inward_data.get('equipments') and len(inward_data['equipments']) > 0:
            equipment = inward_data['equipments'][0]
    
    standards = None
    repeatability_data = []
    reproducability_data = []
    geometric_data = []
    interface_data = []
    loading_data = []
    environment_results = None
    job_id = None
    
    if equipment:
        # Get inward_eqp_id from equipment
        inward_eqp_id = equipment.get('inward_eqp_id')
        if inward_eqp_id:
            # Fetch job_id from inward_eqp_id
            job_id = fetch_job_id_from_inward_eqp_id(inward_eqp_id, api_base_url)
            if job_id:
                # Fetch standards from job_id
                standards = fetch_standards_from_job_id(job_id, api_base_url)
                
                # Fetch repeatability data from job_id
                repeatability_results = fetch_repeatability_from_job_id(job_id, api_base_url)
                if repeatability_results:
                    repeatability_data = map_repeatability_to_certificate_data(repeatability_results)
                
                # Fetch reproducibility data from job_id
                reproducibility_results = fetch_reproducibility_from_job_id(job_id, api_base_url)
                if reproducibility_results:
                    reproducability_data = map_reproducibility_to_certificate_data(reproducibility_results)
                
                # Fetch output drive variation data from job_id
                output_drive_results = fetch_output_drive_from_job_id(job_id, api_base_url)
                if output_drive_results:
                    geometric_data = map_output_drive_to_certificate_data(output_drive_results)
                
                # Fetch drive interface variation data from job_id
                drive_interface_results = fetch_drive_interface_from_job_id(job_id, api_base_url)
                if drive_interface_results:
                    interface_data = map_drive_interface_to_certificate_data(drive_interface_results)
                
                # Fetch loading point variation data from job_id
                loading_point_results = fetch_loading_point_from_job_id(job_id, api_base_url)
                if loading_point_results:
                    loading_data = map_loading_point_to_certificate_data(loading_point_results)
                
                # Fetch environment data (PRE and POST) from job_id
                environment_results = fetch_environment_from_job_id(job_id, api_base_url)
    
    # Get base certificate data
    if equipment:
        cert_data = map_equipment_to_certificate_data(equipment, standards, customer, inward_data)
    else:
        cert_data = map_equipment_to_certificate_data({}, standards, customer, inward_data)
    
    # Add repeatability, reproducibility, geometric, interface, and loading data
    cert_data['repeatability_data'] = repeatability_data
    cert_data['reproducability_data'] = reproducability_data
    cert_data['geometric_data'] = geometric_data
    cert_data['interface_data'] = interface_data
    cert_data['loading_data'] = loading_data
    
    # Add environment data (temperature and humidity averages)
    if environment_results:
        env_averages = calculate_average_environment(environment_results)
        cert_data['temperature'] = env_averages.get('temperature', '')
        cert_data['humidity'] = env_averages.get('humidity', '')
    
    # Add logo paths
    cert_data['logo_left'] = 'logo_left.png'  # Logo in the certificate directory
    cert_data['logo_right'] = 'logo_right.png'  # Logo in the certificate directory
    
    return cert_data


def get_empty_data():
    """
    Get empty data structure for certificate page 1.
    All fields will be populated dynamically from database tables.
    Returns a dictionary with all required fields set to empty strings.
    """
    return {
        'certificate_code': '',
        'certificate_no': '',
        'calibration_date': '',
        'nepl_id': '',
        'cal_due_date': '',
        'ulr_no': '',
        'issue_date': '',
        'field_of_parameter': '',
        'customer_name': '',
        'customer_address': '',
        'reference_dc_no': '',
        'reference_no_date': '',
        'receipt_date': '',
        'item_status': '',
        'device_nomenclature': '',
        'device_make_model': '',
        'device_type': '',
        'units_of_measurement': '',
        'calibration_mode': '',
        'place_of_calibration': '',
        'si_no': '',
        'pressure_gauge_resolution': '',
        'torque_range': '',
        'calibration_procedure': '',
        
        # Reference Standards
        'standard1_nomenclature': '',
        'standard1_manufacturer': '',
        'standard1_model': '',
        'standard1_uncertainty': '',
        'standard1_cert_no': '',
        'standard1_valid_upto': '',
        'standard1_traceability': '',
        
        'standard2_nomenclature': '',
        'standard2_manufacturer': '',
        'standard2_model': '',
        'standard2_uncertainty': '',
        'standard2_cert_no': '',
        'standard2_valid_upto': '',
        'standard2_traceability': '',
        
        'standard3_nomenclature': '',
        'standard3_manufacturer': '',
        'standard3_model': '',
        'standard3_uncertainty': '',
        'standard3_cert_no': '',
        'standard3_valid_upto': '',
        'standard3_traceability': '',
        
        'temperature': '',
        'humidity': '',
        'authorised_signatory': '',
        
        # Optional logo paths
        # 'logo_left': '',
        # 'logo_right': '',
    }


if __name__ == '__main__':
    # Example usage when run directly
    import sys
    
    # Check if inward_id is provided as command line argument
    if len(sys.argv) > 1:
        try:
            inward_id = int(sys.argv[1])
            api_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000/api"
            
            print(f"Fetching inward equipment data for inward_id={inward_id}...")
            data = get_certificate_data_from_inward(inward_id, api_url)
            print("Fetched equipment data from API")
        except ValueError:
            print("Error: Invalid inward_id. Please provide a valid integer inward_id.")
            print("Usage: python render_certificate_page1.py <inward_id> [api_url]")
            sys.exit(1)
    else:
        print("Error: inward_id is required. All certificate data must come from database tables.")
        print("Usage: python render_certificate_page1.py <inward_id> [api_url]")
        sys.exit(1)
    
    # Render and save
    output_file = 'certificate_page1_rendered.html'
    render_certificate_page1(data, output_path=output_file)
    
    print(f"Rendered certificate page 1 -> {output_file}")