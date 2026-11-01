"""Stable entry point for the reproducible Blender asset build."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name('athlete_asset.py')), run_name='__main__')
