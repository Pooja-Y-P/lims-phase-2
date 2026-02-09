"""
Standalone render script for Combined Certificate (All 3 Pages)
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


def render_certificate_combined(data, output_path=None, template_dir=None):
    """
    Render combined certificate (all 3 pages) HTML from template and data.
    
    Args:
        data (dict): Dictionary containing certificate data fields
        output_path (str, optional): Path to save rendered HTML. If None, returns HTML string
        template_dir (str, optional): Directory containing templates. Defaults to current directory
    
    Returns:
        str: Rendered HTML string if output_path is None, otherwise None
    
    Note: Combined certificate requires all data fields for all 3 pages:
        - All fields from page 1 (device info, standards, etc.)
        - repeatability_data, reproducability_data, geometric_data (for page 2)
        - interface_data, loading_data, uncertainty_data (for page 3)
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
            print("Usage: python render_certificate_combined.py <inward_id> [api_url]")
            sys.exit(1)
    else:
        print("Error: inward_id is required. All certificate data must come from database tables.")
        print("Usage: python render_certificate_combined.py <inward_id> [api_url]")
        sys.exit(1)
    
    # Render and save
    output_file = 'certificate_combined_rendered.html'
    render_certificate_combined(data, output_path=output_file)
    
    print(f"Rendered combined certificate (all 3 pages) -> {output_file}")
