# Testing Guide for Certificate Page 1 with Inward Equipment Data

This guide explains how to test the certificate rendering script that fetches inward equipment data from the API.

## Prerequisites

1. **Backend API Server Running**
   - The FastAPI backend must be running on `http://192.168.31.195:8000`
   - Database must be accessible and contain inward equipment data

2. **Python Dependencies**
   - Ensure `requests` library is installed (should be in requirements.txt)
   - Ensure `jinja2` is installed

## Step-by-Step Testing

### Step 1: Start the Backend API Server

Open a terminal and navigate to the project root, then start the backend:

```bash
# Navigate to project root
cd "LIMS PROJ PHASE 2-1/LIMS PROJ PHASE 1"

# Activate virtual environment (if using one)
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Start the backend server
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# OR from project root:
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

You should see output like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx]
INFO:     Started server process [xxxxx]
INFO:     Application startup complete.
```

### Step 2: Find a Valid Inward ID

You need an `inward_id` that exists in your database. You can find one using:

**Option A: Check the API directly**
```bash
# Open browser or use curl
curl http://192.168.31.195:8000/api/staff/inwards

# Or visit in browser:
http://192.168.31.195:8000/api/staff/inwards
```

**Option B: Check the database directly**
```sql
SELECT inward_id FROM inward LIMIT 1;
```

**Option C: Use the API docs**
- Visit: http://192.168.31.195:8000/docs
- Find the `/api/staff/inwards` endpoint
- Click "Try it out" and execute
- Look for an `inward_id` in the response

### Step 3: Test the Certificate Script

Open a **new terminal** (keep the backend running) and navigate to the certificate directory:

```bash
# Navigate to certificate directory
cd "LIMS PROJ PHASE 2-1/LIMS PROJ PHASE 1/certificate"

# Activate virtual environment if needed
# On Windows:
..\venv\Scripts\activate
# On Linux/Mac:
source ../venv/bin/activate

# Test with a specific inward_id (replace 123 with your actual inward_id)
python render_certificate_page1.py 123

# Or specify a custom API URL
python render_certificate_page1.py 123 http://192.168.31.195:8000/api
```

### Step 4: Verify the Output

After running the script, you should see:
```
Fetching inward equipment data for inward_id=123...
✓ Fetched equipment data from API
✓ Rendered certificate page 1 -> certificate_page1_rendered.html
```

**Check the generated file:**
- Open `certificate_page1_rendered.html` in a browser
- Verify that the "Device Under Calibration" section is populated with:
  - Nomenclature (from `material_description`)
  - Make/Model (from `make` and `model`)
  - SI No (from `serial_no`)
  - Torque Range (from `range`)
  - NEPL ID (from `nepl_id`)
- Verify that all other fields are empty

### Step 5: Test Error Handling

**Test with invalid inward_id:**
```bash
python render_certificate_page1.py 99999
```
Should handle gracefully and show an error message.

**Test without arguments (uses default data):**
```bash
python render_certificate_page1.py
```
Should use default sample data.

## Testing in Python Code

You can also test programmatically:

```python
from render_certificate_page1 import get_certificate_data_from_inward, render_certificate_page1

# Fetch equipment data
data = get_certificate_data_from_inward(
    inward_id=123, 
    api_base_url='http://192.168.31.195:8000/api'
)

# Check the data
print("Device Nomenclature:", data.get('device_nomenclature'))
print("Device Make/Model:", data.get('device_make_model'))
print("SI No:", data.get('si_no'))
print("Torque Range:", data.get('torque_range'))

# Render to HTML string
html = render_certificate_page1(data)
print(f"Generated HTML length: {len(html)} characters")

# Or save to file
render_certificate_page1(data, output_path='test_certificate.html')
```

## Troubleshooting

### Error: Connection refused
- **Problem**: Backend API is not running
- **Solution**: Start the backend server (Step 1)

### Error: 404 Not Found
- **Problem**: Invalid `inward_id` or endpoint doesn't exist
- **Solution**: Verify the `inward_id` exists and the API endpoint is correct

### Error: No equipment data found
- **Problem**: The inward record exists but has no equipment
- **Solution**: Use an `inward_id` that has associated equipment records

### Error: Module not found (requests, jinja2)
- **Problem**: Dependencies not installed
- **Solution**: 
  ```bash
  pip install requests jinja2
  ```

### Empty fields in certificate
- **Problem**: Equipment data exists but fields are empty in database
- **Solution**: Check the database to ensure equipment has `material_description`, `make`, `model`, etc.

## Quick Test Script

Create a file `test_certificate.py`:

```python
import requests
from render_certificate_page1 import get_certificate_data_from_inward, render_certificate_page1

# Test API connection
try:
    response = requests.get("http://192.168.31.195:8000/api/staff/inwards", timeout=5)
    if response.status_code == 200:
        inwards = response.json()
        if inwards and len(inwards) > 0:
            test_id = inwards[0]['inward_id']
            print(f"✓ API is accessible")
            print(f"✓ Found inward_id: {test_id}")
            
            # Test certificate generation
            print(f"\nTesting certificate generation for inward_id={test_id}...")
            data = get_certificate_data_from_inward(test_id)
            
            print(f"\n✓ Fetched data:")
            print(f"  - Device Nomenclature: {data.get('device_nomenclature')}")
            print(f"  - Device Make/Model: {data.get('device_make_model')}")
            print(f"  - SI No: {data.get('si_no')}")
            print(f"  - Torque Range: {data.get('torque_range')}")
            
            # Render certificate
            render_certificate_page1(data, output_path='test_output.html')
            print(f"\n✓ Certificate rendered to test_output.html")
        else:
            print("⚠ No inward records found in database")
    else:
        print(f"⚠ API returned status code: {response.status_code}")
except Exception as e:
    print(f"✗ Error connecting to API: {e}")
    print("  Make sure the backend server is running on http://192.168.31.195:8000")
```

Run it:
```bash
python test_certificate.py
```
