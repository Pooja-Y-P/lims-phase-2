"""
Standalone render script for Certificate Page 3 (No Header/Footer)
Can be imported and used in other projects
"""

from jinja2 import Environment, FileSystemLoader
import os
from pathlib import Path
import requests
from typing import Optional, Dict, Any
import sys

# Import shared functions from page1
from render_certificate_page1 import (
    fetch_inward_equipment,
    map_equipment_to_certificate_data,
    get_certificate_data_from_inward,
    get_empty_data
)


def render_certificate_page3_no_header_footer(data, output_path=None, template_dir=None):
    """
    Render certificate page 3 HTML from template and data (no header/footer version).
    
    Args:
        data (dict): Dictionary containing certificate data fields
        output_path (str, optional): Path to save rendered HTML. If None, returns HTML string
        template_dir (str, optional): Directory containing templates. Defaults to current directory
    
    Returns:
        str: Rendered HTML string if output_path is None, otherwise None
    
    Note: Page 3 requires additional data fields for calibration results:
        - interface_data: List of dicts with interface variation test data
        - loading_data: List of dicts with loading point variation test data
        - uncertainty_data: List of dicts with measurement uncertainty data
    """
    # Determine template directory
    if template_dir is None:
        template_dir = Path(__file__).parent
    else:
        template_dir = Path(template_dir)
    
    # Set up Jinja environment
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    
    # Load template (no header/footer version)
    template = env.get_template('certificate_page3_no_header_footer.html')
    
    # Render template with data
    html = template.render(**data)
    
    # Save to file if output_path is provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        return None
    
    # Return HTML string
    return html


if __name__ == '__main__':
    # Example usage when run directly
    # Check if inward_id is provided as command line argument
    if len(sys.argv) > 1:
        try:
            inward_id = int(sys.argv[1])
            api_url = sys.argv[2] if len(sys.argv) > 2 else "http://192.168.31.195:8000/api"
            
            print(f"Fetching inward equipment data for inward_id={inward_id}...")
            data = get_certificate_data_from_inward(inward_id, api_url)
            print("Fetched equipment data from API")
        except ValueError:
            print("Error: Invalid inward_id. Please provide a valid integer inward_id.")
            print("Usage: python render_certificate_page3_no_header_footer.py <inward_id> [api_url]")
            sys.exit(1)
    else:
        print("Error: inward_id is required. All certificate data must come from database tables.")
        print("Usage: python render_certificate_page3_no_header_footer.py <inward_id> [api_url]")
        sys.exit(1)
    
    # Render and save
    output_file = 'certificate_page3_no_header_footer_rendered.html'
    render_certificate_page3_no_header_footer(data, output_path=output_file)
    
    print(f"Rendered certificate page 3 (no header/footer) -> {output_file}")
