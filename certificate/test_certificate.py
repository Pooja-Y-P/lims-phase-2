"""
Quick test script for certificate rendering with inward equipment data
Run this to verify everything is working correctly
"""

import requests
import sys
from pathlib import Path

# Add parent directory to path to import render_certificate_page1
sys.path.insert(0, str(Path(__file__).parent))

from render_certificate_page1 import get_certificate_data_from_inward, render_certificate_page1

def test_api_connection(api_url="http://localhost:8000/api"):
    """Test if the API is accessible"""
    try:
        response = requests.get(f"{api_url}/staff/inwards", timeout=5)
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"API returned status code: {response.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "Cannot connect to API. Is the backend server running?"
    except Exception as e:
        return False, f"Error: {e}"

def main():
    api_url = "http://localhost:8000/api"
    
    print("=" * 60)
    print("Certificate Rendering Test Script")
    print("=" * 60)
    
    # Test 1: Check API connection
    print("\n[Test 1] Checking API connection...")
    is_connected, result = test_api_connection(api_url)
    
    if not is_connected:
        print(f"✗ {result}")
        print("\n⚠️  Please start the backend server first:")
        print("   cd backend")
        print("   uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
        return
    
    print("✓ API is accessible")
    
    # Test 2: Find a valid inward_id
    print("\n[Test 2] Finding a valid inward_id...")
    inwards = result
    
    if not inwards or len(inwards) == 0:
        print("✗ No inward records found in database")
        print("  Please add some inward records first")
        return
    
    # Get first inward with equipment
    test_inward_id = None
    for inward in inwards:
        if inward.get('equipments') and len(inward['equipments']) > 0:
            test_inward_id = inward['inward_id']
            break
    
    if not test_inward_id:
        # Use first inward_id even if no equipment
        test_inward_id = inwards[0]['inward_id']
        print(f"⚠ Found inward_id: {test_inward_id} (but no equipment found)")
    else:
        print(f"✓ Found inward_id: {test_inward_id} with equipment")
    
    # Test 3: Fetch equipment data
    print(f"\n[Test 3] Fetching equipment data for inward_id={test_inward_id}...")
    try:
        data = get_certificate_data_from_inward(test_inward_id, api_url)
        
        print("✓ Data fetched successfully")
        print("\n  Device Under Calibration Fields:")
        print(f"    - Nomenclature: '{data.get('device_nomenclature')}'")
        print(f"    - Make/Model: '{data.get('device_make_model')}'")
        print(f"    - Type: '{data.get('device_type')}'")
        print(f"    - SI No: '{data.get('si_no')}'")
        print(f"    - Torque Range: '{data.get('torque_range')}'")
        print(f"    - NEPL ID: '{data.get('nepl_id')}'")
        
        # Check if other fields are empty
        other_fields = [
            'certificate_code', 'certificate_no', 'calibration_date',
            'customer_name', 'field_of_parameter'
        ]
        all_empty = all(not data.get(field) for field in other_fields)
        if all_empty:
            print("\n  ✓ Other fields are empty (as expected)")
        else:
            print("\n  ⚠ Some other fields are not empty:")
            for field in other_fields:
                if data.get(field):
                    print(f"    - {field}: '{data.get(field)}'")
    
    except Exception as e:
        print(f"✗ Error fetching data: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Test 4: Render certificate
    print(f"\n[Test 4] Rendering certificate...")
    try:
        output_file = 'test_certificate_output.html'
        render_certificate_page1(data, output_path=output_file)
        print(f"✓ Certificate rendered successfully")
        print(f"  Output file: {output_file}")
        print(f"  Open it in a browser to view the certificate")
    
    except Exception as e:
        print(f"✗ Error rendering certificate: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Summary
    print("\n" + "=" * 60)
    print("✓ All tests passed!")
    print("=" * 60)
    print(f"\nTo test with a specific inward_id, run:")
    print(f"  python render_certificate_page1.py {test_inward_id}")
    print(f"\nOr with custom API URL:")
    print(f"  python render_certificate_page1.py {test_inward_id} {api_url}")

if __name__ == '__main__':
    main()
