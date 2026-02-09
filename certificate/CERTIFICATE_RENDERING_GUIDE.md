# Certificate Rendering Guide

This guide explains how to render certificate pages using the Python scripts.

## Available Scripts

1. **render_certificate_page1.py** - Renders Page 1 only
2. **render_certificate_page2.py** - Renders Page 2 only
3. **render_certificate_page3.py** - Renders Page 3 only
4. **render_certificate_combined.py** - Renders all 3 pages in one file

## Prerequisites

- Python 3.x installed
- Backend API running (default: http://192.168.31.195:8000/api)
- Jinja2 installed: `pip install jinja2`
- requests installed: `pip install requests`

## Usage

### Basic Usage (with inward_id)

All scripts require an `inward_id` as a command-line argument:

```bash
# Render Page 1
python render_certificate_page1.py <inward_id>

# Render Page 2
python render_certificate_page2.py <inward_id>

# Render Page 3
python render_certificate_page3.py <inward_id>

# Render Combined (all 3 pages)
python render_certificate_combined.py <inward_id>
```

### Custom API URL

If your backend is running on a different URL:

```bash
python render_certificate_page1.py <inward_id> http://your-api-url:8000/api
```

### Examples

```bash
# Render page 1 for inward_id 123
python render_certificate_page1.py 123

# Render combined certificate for inward_id 456 with custom API
python render_certificate_combined.py 456 http://192.168.1.100:8000/api
```

## Output Files

- Page 1: `certificate_page1_rendered.html`
- Page 2: `certificate_page2_rendered.html`
- Page 3: `certificate_page3_rendered.html`
- Combined: `certificate_combined_rendered.html`

## Data Requirements

### Page 1
Requires all basic certificate fields:
- Certificate number, dates
- Customer information
- Device under calibration details
- Reference standard details
- Environmental conditions

### Page 2
Requires Page 1 data PLUS:
- `repeatability_data`: List of repeatability test results
- `reproducability_data`: List of reproducability test results
- `geometric_data`: List of geometric effect test results

### Page 3
Requires Page 1 data PLUS:
- `interface_data`: List of interface variation test results
- `loading_data`: List of loading point variation test results
- `uncertainty_data`: List of measurement uncertainty results

### Combined
Requires ALL data from Pages 1, 2, and 3.

## Notes

- All data comes from database tables (no default values)
- The scripts fetch data from the API endpoint: `/api/staff/inwards/{inward_id}`
- If data is missing, fields will be empty (not show default values)
- "Ramesh Ramakrishna" is hardcoded under "Authorised Signatory"
- QR code is automatically included in Page 1 (and combined Page 1)

## Troubleshooting

### Error: "inward_id is required"
Make sure you provide the inward_id as the first argument:
```bash
python render_certificate_page1.py 123
```

### Error: "Invalid inward_id"
The inward_id must be a valid integer:
```bash
python render_certificate_page1.py 123  # ✓ Correct
python render_certificate_page1.py abc  # ✗ Wrong
```

### Error: Connection refused
Make sure your backend API is running:
```bash
# Check if API is accessible
curl http://192.168.31.195:8000/api/staff/inwards/123
```

### Import Error
Make sure all scripts are in the same directory:
- `render_certificate_page1.py`
- `render_certificate_page2.py`
- `render_certificate_page3.py`
- `render_certificate_combined.py`
- `base_template.html`
- `certificate_page1.html`
- `certificate_page2.html`
- `certificate_page3.html`
- `certificate_combined.html`
