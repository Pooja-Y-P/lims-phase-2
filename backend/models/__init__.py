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

# You might also want to import Base here to make it accessible
from backend.db import Base