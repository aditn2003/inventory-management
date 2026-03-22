"""
Seed script — run once on startup if SEED_ON_STARTUP=true.
Creates: 1 admin user, 1 regular user, 17 tenants, diverse products per tenant,
         inventory rows, and sample orders.
"""

import asyncio
import os
import random
import uuid
from datetime import date, timedelta
from decimal import Decimal

from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.auth.models import User
from app.tenants.models import Tenant
from app.products.models import Product
from app.inventory.models import Inventory
from app.orders.models import Order

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_EMAIL = "admin@ims.com"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123!")
USER_EMAIL = "user@ims.com"
USER_PASSWORD = os.getenv("USER_PASSWORD", "user123!")

# ── Original 2 tenants (kept as-is) ──────────────────────────────────────────

ORIGINAL_TENANTS = [
    {"display_id": "TEN-001", "name": "Alpha Manufacturing", "status": "active"},
    {"display_id": "TEN-002", "name": "Beta Chemicals Ltd", "status": "active"},
]

ORIGINAL_PRODUCTS = [
    [
        {
            "sku": "ALU-001",
            "name": "Aluminium Sheet 2mm",
            "category": "Metals",
            "cost_per_unit": Decimal("45.50"),
            "reorder_threshold": 50,
            "unit": "sheets",
            "description": "High-grade aluminium sheet",
        },
        {
            "sku": "STL-002",
            "name": "Steel Rod 10mm",
            "category": "Metals",
            "cost_per_unit": Decimal("12.00"),
            "reorder_threshold": 100,
            "unit": "units",
            "description": "Mild steel rod",
        },
        {
            "sku": "COP-003",
            "name": "Copper Wire 1mm",
            "category": "Metals",
            "cost_per_unit": Decimal("8.75"),
            "reorder_threshold": 200,
            "unit": "kg",
            "description": "99.9% copper wire",
        },
        {
            "sku": "RUB-004",
            "name": "Rubber Seal Kit",
            "category": "Plastics",
            "cost_per_unit": Decimal("3.20"),
            "reorder_threshold": 30,
            "unit": "units",
            "description": "Industrial rubber seals",
        },
        {
            "sku": "PLX-005",
            "name": "Polyethylene Film",
            "category": "Plastics",
            "cost_per_unit": Decimal("22.00"),
            "reorder_threshold": 15,
            "unit": "kg",
            "description": "Clear PE film",
        },
    ],
    [
        {
            "sku": "ACE-001",
            "name": "Acetone Solvent",
            "category": "Chemicals",
            "cost_per_unit": Decimal("18.00"),
            "reorder_threshold": 40,
            "unit": "litres",
            "description": "Industrial acetone",
        },
        {
            "sku": "HCL-002",
            "name": "Hydrochloric Acid 30%",
            "category": "Chemicals",
            "cost_per_unit": Decimal("25.50"),
            "reorder_threshold": 20,
            "unit": "litres",
            "description": "Technical grade HCl",
        },
        {
            "sku": "ETH-003",
            "name": "Ethanol 99%",
            "category": "Chemicals",
            "cost_per_unit": Decimal("14.80"),
            "reorder_threshold": 60,
            "unit": "litres",
            "description": "High-purity ethanol",
        },
        {
            "sku": "NIT-004",
            "name": "Nitrogen Gas Cylinder",
            "category": "Chemicals",
            "cost_per_unit": Decimal("95.00"),
            "reorder_threshold": 5,
            "unit": "units",
            "description": "Industrial N2",
        },
        {
            "sku": "PVC-005",
            "name": "PVC Pellets",
            "category": "Plastics",
            "cost_per_unit": Decimal("6.40"),
            "reorder_threshold": 80,
            "unit": "kg",
            "description": "Virgin PVC pellets",
        },
    ],
]

ORIGINAL_STOCK = [120, 8, 350, 25, 5, 80, 15, 200, 3, 150]

# ── 15 new tenants ────────────────────────────────────────────────────────────

NEW_TENANTS = [
    {"display_id": "TEN-003", "name": "Gamma Electronics Co", "status": "active"},
    {"display_id": "TEN-004", "name": "Delta Textiles Inc", "status": "active"},
    {
        "display_id": "TEN-005",
        "name": "Epsilon Packaging Solutions",
        "status": "active",
    },
    {"display_id": "TEN-006", "name": "Zeta Industrial Tools", "status": "active"},
    {"display_id": "TEN-007", "name": "Eta Glass Works", "status": "active"},
    {"display_id": "TEN-008", "name": "Theta Ceramics Corp", "status": "active"},
    {"display_id": "TEN-009", "name": "Iota Adhesives & Sealants", "status": "active"},
    {"display_id": "TEN-010", "name": "Kappa Steel Industries", "status": "active"},
    {"display_id": "TEN-011", "name": "Lambda Polymers Ltd", "status": "active"},
    {"display_id": "TEN-012", "name": "Mu Precision Parts", "status": "active"},
    {"display_id": "TEN-013", "name": "Nu Chemical Distributors", "status": "active"},
    {"display_id": "TEN-014", "name": "Xi Fabrication Inc", "status": "inactive"},
    {"display_id": "TEN-015", "name": "Omicron Supply Chain", "status": "active"},
    {"display_id": "TEN-016", "name": "Pi Tech Materials", "status": "active"},
    {"display_id": "TEN-017", "name": "Rho Electrical Components", "status": "active"},
]

NEW_PRODUCTS = [
    # TEN-003  Gamma Electronics Co
    [
        {
            "sku": "RES-001",
            "name": "Carbon Film Resistor 1kΩ",
            "category": "Electronics",
            "cost_per_unit": Decimal("0.05"),
            "reorder_threshold": 5000,
            "unit": "pcs",
            "description": "1/4W carbon film resistor",
        },
        {
            "sku": "CAP-002",
            "name": "Ceramic Capacitor 100nF",
            "category": "Electronics",
            "cost_per_unit": Decimal("0.12"),
            "reorder_threshold": 3000,
            "unit": "pcs",
            "description": "50V MLCC capacitor",
        },
        {
            "sku": "LED-003",
            "name": "SMD LED White 5mm",
            "category": "Electronics",
            "cost_per_unit": Decimal("0.08"),
            "reorder_threshold": 10000,
            "unit": "pcs",
            "description": "High-brightness white LED",
        },
        {
            "sku": "PCB-004",
            "name": "FR4 PCB Blank 100x100mm",
            "category": "Electronics",
            "cost_per_unit": Decimal("2.50"),
            "reorder_threshold": 200,
            "unit": "pcs",
            "description": "Double-sided copper-clad board",
        },
        {
            "sku": "SOL-005",
            "name": "Solder Wire 60/40 1mm",
            "category": "Tools",
            "cost_per_unit": Decimal("15.00"),
            "reorder_threshold": 50,
            "unit": "rolls",
            "description": "Rosin-core solder wire 500g",
        },
        {
            "sku": "ICM-006",
            "name": "ATmega328P Microcontroller",
            "category": "Electronics",
            "cost_per_unit": Decimal("3.20"),
            "reorder_threshold": 500,
            "unit": "pcs",
            "description": "8-bit AVR microcontroller",
        },
    ],
    # TEN-004  Delta Textiles Inc
    [
        {
            "sku": "COT-001",
            "name": 'Cotton Fabric Roll 60"',
            "category": "Textiles",
            "cost_per_unit": Decimal("8.50"),
            "reorder_threshold": 100,
            "unit": "metres",
            "description": "100% cotton plain weave",
        },
        {
            "sku": "PLY-002",
            "name": "Polyester Blend Fabric",
            "category": "Textiles",
            "cost_per_unit": Decimal("6.20"),
            "reorder_threshold": 150,
            "unit": "metres",
            "description": "65/35 poly-cotton blend",
        },
        {
            "sku": "SLK-003",
            "name": "Silk Charmeuse",
            "category": "Textiles",
            "cost_per_unit": Decimal("45.00"),
            "reorder_threshold": 30,
            "unit": "metres",
            "description": "19mm mulberry silk",
        },
        {
            "sku": "DYE-004",
            "name": "Reactive Dye Blue #42",
            "category": "Chemicals",
            "cost_per_unit": Decimal("32.00"),
            "reorder_threshold": 20,
            "unit": "kg",
            "description": "Cold-water reactive dye",
        },
        {
            "sku": "THR-005",
            "name": "Industrial Thread Spool",
            "category": "Textiles",
            "cost_per_unit": Decimal("4.50"),
            "reorder_threshold": 200,
            "unit": "rolls",
            "description": "Polyester sewing thread 5000m",
        },
        {
            "sku": "ELT-006",
            "name": "Elastic Band 25mm",
            "category": "Textiles",
            "cost_per_unit": Decimal("1.20"),
            "reorder_threshold": 500,
            "unit": "metres",
            "description": "Knitted elastic webbing",
        },
        {
            "sku": "WOL-007",
            "name": "Merino Wool Yarn",
            "category": "Textiles",
            "cost_per_unit": Decimal("18.00"),
            "reorder_threshold": 60,
            "unit": "kg",
            "description": "Extra-fine 19.5 micron merino",
        },
    ],
    # TEN-005  Epsilon Packaging Solutions
    [
        {
            "sku": "BOX-001",
            "name": "Corrugated Box 12x12x12",
            "category": "Packaging",
            "cost_per_unit": Decimal("1.80"),
            "reorder_threshold": 500,
            "unit": "units",
            "description": "Single-wall kraft corrugated",
        },
        {
            "sku": "BUB-002",
            "name": "Bubble Wrap Roll 300mm",
            "category": "Packaging",
            "cost_per_unit": Decimal("12.00"),
            "reorder_threshold": 80,
            "unit": "rolls",
            "description": "Small bubble 10mm diameter",
        },
        {
            "sku": "SHR-003",
            "name": "Shrink Wrap Film 500mm",
            "category": "Packaging",
            "cost_per_unit": Decimal("18.50"),
            "reorder_threshold": 40,
            "unit": "rolls",
            "description": "PVC shrink wrap 25 micron",
        },
        {
            "sku": "TPE-004",
            "name": "Packing Tape 48mm",
            "category": "Packaging",
            "cost_per_unit": Decimal("2.40"),
            "reorder_threshold": 300,
            "unit": "rolls",
            "description": "BOPP clear packing tape 66m",
        },
        {
            "sku": "FOA-005",
            "name": "Foam Peanuts 14cu ft",
            "category": "Packaging",
            "cost_per_unit": Decimal("22.00"),
            "reorder_threshold": 25,
            "unit": "bags",
            "description": "Anti-static loose fill",
        },
        {
            "sku": "LBL-006",
            "name": "Shipping Labels A4 Sheet",
            "category": "Packaging",
            "cost_per_unit": Decimal("0.15"),
            "reorder_threshold": 2000,
            "unit": "sheets",
            "description": "Self-adhesive matte labels",
        },
    ],
    # TEN-006  Zeta Industrial Tools
    [
        {
            "sku": "DRL-001",
            "name": "HSS Drill Bit Set 1-13mm",
            "category": "Tools",
            "cost_per_unit": Decimal("28.00"),
            "reorder_threshold": 40,
            "unit": "units",
            "description": "25-piece titanium-coated set",
        },
        {
            "sku": "WRN-002",
            "name": "Combination Wrench Set",
            "category": "Tools",
            "cost_per_unit": Decimal("65.00"),
            "reorder_threshold": 20,
            "unit": "units",
            "description": "12pc metric 8-19mm CrV",
        },
        {
            "sku": "CUT-003",
            "name": "Abrasive Cut-off Disc 125mm",
            "category": "Tools",
            "cost_per_unit": Decimal("1.50"),
            "reorder_threshold": 500,
            "unit": "pcs",
            "description": "Metal cutting disc 1mm thick",
        },
        {
            "sku": "GLV-004",
            "name": "Nitrile Work Gloves L",
            "category": "Tools",
            "cost_per_unit": Decimal("8.00"),
            "reorder_threshold": 100,
            "unit": "boxes",
            "description": "Heavy-duty nitrile 100/box",
        },
        {
            "sku": "TAP-005",
            "name": "Measuring Tape 8m",
            "category": "Tools",
            "cost_per_unit": Decimal("12.00"),
            "reorder_threshold": 60,
            "unit": "units",
            "description": "Auto-lock steel blade",
        },
        {
            "sku": "SAW-006",
            "name": "Bi-Metal Hacksaw Blade",
            "category": "Tools",
            "cost_per_unit": Decimal("3.50"),
            "reorder_threshold": 200,
            "unit": "pcs",
            "description": "300mm 24TPI HSS blade",
        },
        {
            "sku": "VIS-007",
            "name": "Bench Vise 150mm",
            "category": "Tools",
            "cost_per_unit": Decimal("85.00"),
            "reorder_threshold": 10,
            "unit": "units",
            "description": "Cast iron swivel base",
        },
    ],
    # TEN-007  Eta Glass Works
    [
        {
            "sku": "FLG-001",
            "name": "Float Glass 4mm Clear",
            "category": "Glass",
            "cost_per_unit": Decimal("18.00"),
            "reorder_threshold": 80,
            "unit": "sheets",
            "description": "Standard clear float glass 1220x2440mm",
        },
        {
            "sku": "TMG-002",
            "name": "Tempered Glass 6mm",
            "category": "Glass",
            "cost_per_unit": Decimal("42.00"),
            "reorder_threshold": 30,
            "unit": "sheets",
            "description": "Toughened safety glass",
        },
        {
            "sku": "MRR-003",
            "name": "Silver Mirror Glass 5mm",
            "category": "Glass",
            "cost_per_unit": Decimal("35.00"),
            "reorder_threshold": 25,
            "unit": "sheets",
            "description": "Copper-free mirror",
        },
        {
            "sku": "LAM-004",
            "name": "Laminated Glass 6.38mm",
            "category": "Glass",
            "cost_per_unit": Decimal("55.00"),
            "reorder_threshold": 15,
            "unit": "sheets",
            "description": "PVB interlayer safety glass",
        },
        {
            "sku": "FRG-005",
            "name": "Frosted Glass Panel",
            "category": "Glass",
            "cost_per_unit": Decimal("30.00"),
            "reorder_threshold": 40,
            "unit": "sheets",
            "description": "Acid-etched frosted finish",
        },
        {
            "sku": "SIL-006",
            "name": "Silicone Sealant Clear",
            "category": "Adhesives",
            "cost_per_unit": Decimal("6.50"),
            "reorder_threshold": 100,
            "unit": "tubes",
            "description": "Neutral cure glass sealant",
        },
    ],
    # TEN-008  Theta Ceramics Corp
    [
        {
            "sku": "POR-001",
            "name": "Porcelain Floor Tile 600x600",
            "category": "Ceramics",
            "cost_per_unit": Decimal("12.00"),
            "reorder_threshold": 200,
            "unit": "pcs",
            "description": "Matte grey porcelain tile",
        },
        {
            "sku": "MOZ-002",
            "name": "Glass Mosaic Sheet",
            "category": "Ceramics",
            "cost_per_unit": Decimal("8.50"),
            "reorder_threshold": 150,
            "unit": "sheets",
            "description": "300x300mm mixed-color mosaic",
        },
        {
            "sku": "GRT-003",
            "name": "Tile Grout White 5kg",
            "category": "Adhesives",
            "cost_per_unit": Decimal("7.20"),
            "reorder_threshold": 80,
            "unit": "units",
            "description": "Flexible anti-mould grout",
        },
        {
            "sku": "CRA-004",
            "name": "Ceramic Crucible 500ml",
            "category": "Ceramics",
            "cost_per_unit": Decimal("22.00"),
            "reorder_threshold": 30,
            "unit": "pcs",
            "description": "High-alumina lab crucible",
        },
        {
            "sku": "KLN-005",
            "name": "Kiln Shelf 300x300mm",
            "category": "Ceramics",
            "cost_per_unit": Decimal("45.00"),
            "reorder_threshold": 15,
            "unit": "pcs",
            "description": "Silicon carbide kiln furniture",
        },
    ],
    # TEN-009  Iota Adhesives & Sealants
    [
        {
            "sku": "EPX-001",
            "name": "Epoxy Resin 2-Part 1kg",
            "category": "Adhesives",
            "cost_per_unit": Decimal("24.00"),
            "reorder_threshold": 60,
            "unit": "units",
            "description": "Structural bonding epoxy",
        },
        {
            "sku": "CYA-002",
            "name": "Cyanoacrylate Super Glue 50g",
            "category": "Adhesives",
            "cost_per_unit": Decimal("5.80"),
            "reorder_threshold": 200,
            "unit": "units",
            "description": "Industrial-grade instant adhesive",
        },
        {
            "sku": "PUR-003",
            "name": "PU Sealant Grey 310ml",
            "category": "Adhesives",
            "cost_per_unit": Decimal("8.50"),
            "reorder_threshold": 100,
            "unit": "tubes",
            "description": "Polyurethane construction sealant",
        },
        {
            "sku": "HMA-004",
            "name": "Hot Melt Glue Sticks 11mm",
            "category": "Adhesives",
            "cost_per_unit": Decimal("0.40"),
            "reorder_threshold": 1000,
            "unit": "pcs",
            "description": "EVA glue stick 200mm length",
        },
        {
            "sku": "SPR-005",
            "name": "Spray Adhesive 500ml",
            "category": "Adhesives",
            "cost_per_unit": Decimal("12.00"),
            "reorder_threshold": 50,
            "unit": "units",
            "description": "Multi-purpose contact spray",
        },
        {
            "sku": "THD-006",
            "name": "Thread Locker Blue 50ml",
            "category": "Adhesives",
            "cost_per_unit": Decimal("14.50"),
            "reorder_threshold": 80,
            "unit": "units",
            "description": "Medium-strength anaerobic adhesive",
        },
        {
            "sku": "MSP-007",
            "name": "MS Polymer Sealant White",
            "category": "Adhesives",
            "cost_per_unit": Decimal("9.00"),
            "reorder_threshold": 120,
            "unit": "tubes",
            "description": "Hybrid sealant/adhesive",
        },
    ],
    # TEN-010  Kappa Steel Industries
    [
        {
            "sku": "STS-001",
            "name": "Stainless Steel Sheet 2mm",
            "category": "Metals",
            "cost_per_unit": Decimal("78.00"),
            "reorder_threshold": 40,
            "unit": "sheets",
            "description": "304 grade 1220x2440mm",
        },
        {
            "sku": "GIS-002",
            "name": "Galvanized I-Beam 150mm",
            "category": "Metals",
            "cost_per_unit": Decimal("125.00"),
            "reorder_threshold": 20,
            "unit": "metres",
            "description": "Hot-dip galvanized structural beam",
        },
        {
            "sku": "MSR-003",
            "name": "Mild Steel Round Bar 25mm",
            "category": "Metals",
            "cost_per_unit": Decimal("15.00"),
            "reorder_threshold": 100,
            "unit": "metres",
            "description": "EN3B bright drawn bar",
        },
        {
            "sku": "BRS-004",
            "name": "Brass Rod 12mm",
            "category": "Metals",
            "cost_per_unit": Decimal("22.00"),
            "reorder_threshold": 60,
            "unit": "metres",
            "description": "CZ121 free-machining brass",
        },
        {
            "sku": "WLD-005",
            "name": "Welding Electrode E6013",
            "category": "Tools",
            "cost_per_unit": Decimal("18.00"),
            "reorder_threshold": 50,
            "unit": "boxes",
            "description": "General purpose welding rod 2.5mm 5kg",
        },
        {
            "sku": "ANP-006",
            "name": "Angle Plate Steel 50x50x5",
            "category": "Metals",
            "cost_per_unit": Decimal("4.80"),
            "reorder_threshold": 200,
            "unit": "metres",
            "description": "Hot rolled equal angle",
        },
    ],
    # TEN-011  Lambda Polymers Ltd
    [
        {
            "sku": "ABS-001",
            "name": "ABS Pellets Natural",
            "category": "Plastics",
            "cost_per_unit": Decimal("3.50"),
            "reorder_threshold": 500,
            "unit": "kg",
            "description": "Injection moulding grade ABS",
        },
        {
            "sku": "NYL-002",
            "name": "Nylon 6 Rod 50mm",
            "category": "Plastics",
            "cost_per_unit": Decimal("28.00"),
            "reorder_threshold": 30,
            "unit": "metres",
            "description": "Cast nylon round bar",
        },
        {
            "sku": "PTF-003",
            "name": "PTFE Sheet 3mm",
            "category": "Plastics",
            "cost_per_unit": Decimal("65.00"),
            "reorder_threshold": 15,
            "unit": "sheets",
            "description": "Virgin PTFE skived sheet",
        },
        {
            "sku": "PET-004",
            "name": "PET Preforms 28mm",
            "category": "Plastics",
            "cost_per_unit": Decimal("0.08"),
            "reorder_threshold": 10000,
            "unit": "pcs",
            "description": "Bottle preform 500ml capacity",
        },
        {
            "sku": "PPR-005",
            "name": "Polypropylene Granules",
            "category": "Plastics",
            "cost_per_unit": Decimal("2.80"),
            "reorder_threshold": 800,
            "unit": "kg",
            "description": "Homopolymer PP copolymer",
        },
        {
            "sku": "SIR-006",
            "name": "Silicone Rubber Sheet 2mm",
            "category": "Plastics",
            "cost_per_unit": Decimal("35.00"),
            "reorder_threshold": 25,
            "unit": "sheets",
            "description": "Food-grade silicone 60 Shore A",
        },
    ],
    # TEN-012  Mu Precision Parts
    [
        {
            "sku": "BRG-001",
            "name": "Ball Bearing 6205 2RS",
            "category": "Metals",
            "cost_per_unit": Decimal("4.50"),
            "reorder_threshold": 300,
            "unit": "pcs",
            "description": "Deep groove sealed bearing 25x52x15mm",
        },
        {
            "sku": "GER-002",
            "name": "Spur Gear Module 2 Z20",
            "category": "Metals",
            "cost_per_unit": Decimal("12.00"),
            "reorder_threshold": 100,
            "unit": "pcs",
            "description": "C45 steel hardened spur gear",
        },
        {
            "sku": "SHF-003",
            "name": "Ground Shaft 20mm h6",
            "category": "Metals",
            "cost_per_unit": Decimal("18.00"),
            "reorder_threshold": 50,
            "unit": "metres",
            "description": "Chrome-plated linear shaft",
        },
        {
            "sku": "ORS-004",
            "name": "O-Ring Kit Metric NBR",
            "category": "Plastics",
            "cost_per_unit": Decimal("15.00"),
            "reorder_threshold": 40,
            "unit": "units",
            "description": "225pc assorted nitrile O-rings",
        },
        {
            "sku": "SCR-005",
            "name": "Socket Cap Screw M8x30",
            "category": "Metals",
            "cost_per_unit": Decimal("0.18"),
            "reorder_threshold": 2000,
            "unit": "pcs",
            "description": "12.9 grade alloy steel DIN 912",
        },
        {
            "sku": "SPG-006",
            "name": "Compression Spring 20x50",
            "category": "Metals",
            "cost_per_unit": Decimal("0.80"),
            "reorder_threshold": 500,
            "unit": "pcs",
            "description": "Stainless steel compression spring",
        },
    ],
    # TEN-013  Nu Chemical Distributors
    [
        {
            "sku": "NaOH-01",
            "name": "Sodium Hydroxide Flakes",
            "category": "Chemicals",
            "cost_per_unit": Decimal("8.50"),
            "reorder_threshold": 200,
            "unit": "kg",
            "description": "Caustic soda 99% purity",
        },
        {
            "sku": "H2O2-02",
            "name": "Hydrogen Peroxide 35%",
            "category": "Chemicals",
            "cost_per_unit": Decimal("12.00"),
            "reorder_threshold": 100,
            "unit": "litres",
            "description": "Industrial-grade H2O2",
        },
        {
            "sku": "IPA-003",
            "name": "Isopropyl Alcohol 99%",
            "category": "Chemicals",
            "cost_per_unit": Decimal("16.00"),
            "reorder_threshold": 80,
            "unit": "litres",
            "description": "Electronic-grade IPA",
        },
        {
            "sku": "H2SO-04",
            "name": "Sulphuric Acid 98%",
            "category": "Chemicals",
            "cost_per_unit": Decimal("22.00"),
            "reorder_threshold": 30,
            "unit": "litres",
            "description": "Reagent-grade sulphuric acid",
        },
        {
            "sku": "MEK-005",
            "name": "Methyl Ethyl Ketone",
            "category": "Chemicals",
            "cost_per_unit": Decimal("14.50"),
            "reorder_threshold": 60,
            "unit": "litres",
            "description": "MEK solvent technical grade",
        },
        {
            "sku": "CIT-006",
            "name": "Citric Acid Monohydrate",
            "category": "Chemicals",
            "cost_per_unit": Decimal("5.00"),
            "reorder_threshold": 150,
            "unit": "kg",
            "description": "Food-grade citric acid",
        },
        {
            "sku": "TIO-007",
            "name": "Titanium Dioxide Powder",
            "category": "Chemicals",
            "cost_per_unit": Decimal("28.00"),
            "reorder_threshold": 40,
            "unit": "kg",
            "description": "Rutile TiO2 pigment",
        },
    ],
    # TEN-014  Xi Fabrication Inc (inactive tenant)
    [
        {
            "sku": "SST-001",
            "name": "SS Tube 25mm OD",
            "category": "Metals",
            "cost_per_unit": Decimal("32.00"),
            "reorder_threshold": 40,
            "unit": "metres",
            "description": "304 stainless seamless tube",
        },
        {
            "sku": "ALR-002",
            "name": "Aluminium Extrusion T-Slot",
            "category": "Metals",
            "cost_per_unit": Decimal("15.00"),
            "reorder_threshold": 80,
            "unit": "metres",
            "description": "20x20mm 6063-T5 profile",
        },
        {
            "sku": "FLX-003",
            "name": "Flexible Conduit 20mm",
            "category": "Plastics",
            "cost_per_unit": Decimal("3.50"),
            "reorder_threshold": 200,
            "unit": "metres",
            "description": "PVC coated metal conduit",
        },
        {
            "sku": "INS-004",
            "name": "Insulation Foam Board 50mm",
            "category": "Packaging",
            "cost_per_unit": Decimal("9.00"),
            "reorder_threshold": 60,
            "unit": "sheets",
            "description": "XPS rigid foam insulation",
        },
        {
            "sku": "RVT-005",
            "name": "Blind Rivet 4.8x12mm",
            "category": "Metals",
            "cost_per_unit": Decimal("0.06"),
            "reorder_threshold": 5000,
            "unit": "pcs",
            "description": "Aluminium/steel pop rivet",
        },
    ],
    # TEN-015  Omicron Supply Chain
    [
        {
            "sku": "PLT-001",
            "name": "Wooden Pallet 1200x800",
            "category": "Packaging",
            "cost_per_unit": Decimal("15.00"),
            "reorder_threshold": 100,
            "unit": "units",
            "description": "Euro pallet heat treated",
        },
        {
            "sku": "STW-002",
            "name": "Stretch Wrap 500mm 23mu",
            "category": "Packaging",
            "cost_per_unit": Decimal("8.50"),
            "reorder_threshold": 60,
            "unit": "rolls",
            "description": "Machine-grade stretch film",
        },
        {
            "sku": "CRB-003",
            "name": "Cardboard Dividers",
            "category": "Packaging",
            "cost_per_unit": Decimal("0.50"),
            "reorder_threshold": 1000,
            "unit": "pcs",
            "description": "Custom cell divider inserts",
        },
        {
            "sku": "PPB-004",
            "name": "Poly Mailer Bag 300x400",
            "category": "Packaging",
            "cost_per_unit": Decimal("0.25"),
            "reorder_threshold": 2000,
            "unit": "pcs",
            "description": "Co-extruded courier bag",
        },
        {
            "sku": "VCI-005",
            "name": "VCI Paper Roll 600mm",
            "category": "Packaging",
            "cost_per_unit": Decimal("28.00"),
            "reorder_threshold": 20,
            "unit": "rolls",
            "description": "Volatile corrosion inhibitor paper",
        },
        {
            "sku": "DSC-006",
            "name": "Desiccant Sachets 10g",
            "category": "Packaging",
            "cost_per_unit": Decimal("0.12"),
            "reorder_threshold": 5000,
            "unit": "pcs",
            "description": "Silica gel moisture absorber",
        },
    ],
    # TEN-016  Pi Tech Materials
    [
        {
            "sku": "CFB-001",
            "name": "Carbon Fibre Sheet 2mm",
            "category": "Plastics",
            "cost_per_unit": Decimal("120.00"),
            "reorder_threshold": 10,
            "unit": "sheets",
            "description": "3K twill weave CFRP panel",
        },
        {
            "sku": "KVL-002",
            "name": "Kevlar Fabric 200gsm",
            "category": "Textiles",
            "cost_per_unit": Decimal("85.00"),
            "reorder_threshold": 15,
            "unit": "metres",
            "description": "Para-aramid plain weave",
        },
        {
            "sku": "TIT-003",
            "name": "Titanium Sheet Grade 5",
            "category": "Metals",
            "cost_per_unit": Decimal("210.00"),
            "reorder_threshold": 5,
            "unit": "sheets",
            "description": "Ti-6Al-4V 1mm aerospace grade",
        },
        {
            "sku": "CER-004",
            "name": "Alumina Ceramic Rod 10mm",
            "category": "Ceramics",
            "cost_per_unit": Decimal("18.00"),
            "reorder_threshold": 50,
            "unit": "pcs",
            "description": "99.5% Al2O3 ground rod",
        },
        {
            "sku": "GRF-005",
            "name": "Graphite Block 50x50x100",
            "category": "Ceramics",
            "cost_per_unit": Decimal("32.00"),
            "reorder_threshold": 20,
            "unit": "pcs",
            "description": "Isostatic-pressed fine-grain graphite",
        },
        {
            "sku": "QTZ-006",
            "name": "Quartz Glass Tube 25mm",
            "category": "Glass",
            "cost_per_unit": Decimal("45.00"),
            "reorder_threshold": 15,
            "unit": "pcs",
            "description": "Fused silica tube 1m length",
        },
        {
            "sku": "TPR-007",
            "name": "Thermal Paste 30g",
            "category": "Adhesives",
            "cost_per_unit": Decimal("8.00"),
            "reorder_threshold": 100,
            "unit": "tubes",
            "description": "High-conductivity CPU thermal compound",
        },
    ],
    # TEN-017  Rho Electrical Components
    [
        {
            "sku": "CBL-001",
            "name": "PVC Cable 2.5mm² Twin+E",
            "category": "Electronics",
            "cost_per_unit": Decimal("1.20"),
            "reorder_threshold": 500,
            "unit": "metres",
            "description": "Flat twin and earth 6242Y",
        },
        {
            "sku": "BRK-002",
            "name": "MCB 20A Type B SP",
            "category": "Electronics",
            "cost_per_unit": Decimal("8.50"),
            "reorder_threshold": 80,
            "unit": "pcs",
            "description": "Single pole miniature circuit breaker",
        },
        {
            "sku": "SOK-003",
            "name": "13A Switched Socket Double",
            "category": "Electronics",
            "cost_per_unit": Decimal("6.00"),
            "reorder_threshold": 100,
            "unit": "pcs",
            "description": "BS 1363 white moulded socket",
        },
        {
            "sku": "TRK-004",
            "name": "Cable Trunking 40x25mm",
            "category": "Plastics",
            "cost_per_unit": Decimal("3.80"),
            "reorder_threshold": 150,
            "unit": "metres",
            "description": "Self-adhesive PVC trunking",
        },
        {
            "sku": "CNT-005",
            "name": "Junction Box IP65",
            "category": "Electronics",
            "cost_per_unit": Decimal("4.20"),
            "reorder_threshold": 100,
            "unit": "pcs",
            "description": "Weatherproof ABS junction box 150x110x70",
        },
        {
            "sku": "LED-006",
            "name": "LED Panel Light 600x600",
            "category": "Electronics",
            "cost_per_unit": Decimal("35.00"),
            "reorder_threshold": 30,
            "unit": "pcs",
            "description": "40W 4000K recessed panel",
        },
    ],
]


def order_status_from_inventory(current_stock: int, requested_qty: int) -> str:
    """Match Assignment-Requirement-Document: sufficient stock → created, else pending."""
    return "created" if current_stock >= requested_qty else "pending"


async def seed(session: AsyncSession) -> None:
    result = await session.execute(select(func.count()).select_from(User))
    if result.scalar_one() > 0:
        print("[seed] DB already seeded — skipping.")
        return

    print("[seed] Seeding database...")

    random.seed(42)

    # ── Users ────────────────────────────────────────────────────────────────
    admin = User(
        email=ADMIN_EMAIL,
        name="System Administrator",
        password_hash=pwd_context.hash(ADMIN_PASSWORD),
        role="admin",
    )
    regular_user = User(
        email=USER_EMAIL,
        name="Demo User",
        password_hash=pwd_context.hash(USER_PASSWORD),
        role="user",
    )
    session.add_all([admin, regular_user])
    await session.flush()

    # ── Original Tenants (2) ─────────────────────────────────────────────────
    original_tenant_objs = []
    for t in ORIGINAL_TENANTS:
        tenant = Tenant(**t)
        session.add(tenant)
        original_tenant_objs.append(tenant)
    await session.flush()

    order_counter: dict[uuid.UUID, int] = {}

    for i, tenant in enumerate(original_tenant_objs):
        order_counter[tenant.id] = 1000
        products_data = ORIGINAL_PRODUCTS[i]
        product_objs = []
        for pd in products_data:
            pd_copy = dict(pd)
            unit = pd_copy.pop("unit")
            product = Product(tenant_id=tenant.id, status="active", **pd_copy)
            session.add(product)
            product_objs.append((product, unit))

        await session.flush()

        for j, (product, unit) in enumerate(product_objs):
            stock = ORIGINAL_STOCK[i * 5 + j]
            inv = Inventory(
                product_id=product.id,
                tenant_id=tenant.id,
                current_stock=stock,
                unit=unit,
            )
            session.add(inv)

        await session.flush()

        for j, (product, _) in enumerate(product_objs[:2]):
            order_counter[tenant.id] += 1
            order_num = order_counter[tenant.id]
            display_id = f"ORD-{order_num}"
            stock = ORIGINAL_STOCK[i * 5 + j]
            requested_qty = 10
            status = order_status_from_inventory(stock, requested_qty)
            order = Order(
                display_id=display_id,
                tenant_id=tenant.id,
                product_id=product.id,
                requested_qty=requested_qty,
                status=status,
                order_date=date.today(),
                notes=f"Sample order {j + 1}",
            )
            session.add(order)

    await session.flush()

    # ── New Tenants (15) ─────────────────────────────────────────────────────
    new_tenant_objs = []
    for t in NEW_TENANTS:
        tenant = Tenant(**t)
        session.add(tenant)
        new_tenant_objs.append(tenant)
    await session.flush()

    today = date.today()
    order_notes = [
        "Urgent restock needed",
        "Quarterly replenishment",
        "Client project requirement",
        "Replacing damaged stock",
        "New project kickoff supply",
        "Scheduled maintenance reorder",
        "Warehouse transfer request",
        "Production line demand",
        "Safety stock replenishment",
        "Bulk discount purchase",
    ]

    for idx, tenant in enumerate(new_tenant_objs):
        order_counter[tenant.id] = 1000
        products_data = NEW_PRODUCTS[idx]
        product_objs = []

        for pd in products_data:
            pd_copy = dict(pd)
            unit = pd_copy.pop("unit")
            prod_status = "active" if random.random() > 0.1 else "inactive"
            product = Product(tenant_id=tenant.id, status=prod_status, **pd_copy)
            session.add(product)
            product_objs.append((product, unit))

        await session.flush()

        stock_by_product_id: dict[uuid.UUID, int] = {}
        for product, unit in product_objs:
            threshold = product.reorder_threshold
            if random.random() < 0.25:
                stock = random.randint(0, max(1, threshold - 1))
            else:
                stock = random.randint(threshold, threshold * 5)
            stock_by_product_id[product.id] = stock
            inv = Inventory(
                product_id=product.id,
                tenant_id=tenant.id,
                current_stock=stock,
                unit=unit,
            )
            session.add(inv)

        await session.flush()

        num_orders = random.randint(3, 8)
        active_products = [(p, u) for p, u in product_objs if p.status == "active"]
        if not active_products:
            active_products = product_objs[:1]

        for j in range(num_orders):
            product, _ = random.choice(active_products)
            order_counter[tenant.id] += 1
            order_num = order_counter[tenant.id]
            display_id = f"ORD-{order_num}"
            qty = random.choice([5, 10, 15, 20, 25, 50, 100, 200, 500])
            current_stock = stock_by_product_id[product.id]
            status = order_status_from_inventory(current_stock, qty)
            days_ago = random.randint(0, 90)
            order_dt = today - timedelta(days=days_ago)

            order = Order(
                display_id=display_id,
                tenant_id=tenant.id,
                product_id=product.id,
                requested_qty=qty,
                status=status,
                order_date=order_dt,
                notes=random.choice(order_notes),
            )
            session.add(order)

    await session.commit()
    print(f"[seed] Done. {len(ORIGINAL_TENANTS) + len(NEW_TENANTS)} tenants seeded.")
    print(f"[seed] Admin: {ADMIN_EMAIL} | User: {USER_EMAIL}")


async def run_seed() -> None:
    async with async_session_factory() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(run_seed())
