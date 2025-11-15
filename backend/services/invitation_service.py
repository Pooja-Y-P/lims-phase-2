from fastapi import HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func # Import func for lower and trim
from datetime import datetime, timedelta
from typing import Optional

from backend.models.users import User
from backend.models.customers import Customer
from backend.models.invitations import Invitation
from backend.core.security import hash_password, create_invitation_token
from backend.services.password_service import generate_secure_password
from backend.core.email import send_new_user_invitation_email, send_general_invitation_email, UserRole
from backend.schemas.user_schemas import UserResponse

class InvitationService:
    def __init__(self, db: Session):
        self.db = db

    async def create_invitation(
        self,
        email: str,
        role: str,
        created_by: int,
        background_tasks: BackgroundTasks,
        invited_name: Optional[str] = None,
        company_name: Optional[str] = None,
        company_address: Optional[str] = None,
        phone_number: Optional[str] = None,
        customer_id: Optional[int] = None
    ) -> dict:
        """
        Creates a new user invitation with a secure temporary password.
        Also creates the user record immediately so login works.
        Handles branching logic for staff/engineer/admin vs. customer roles.
        """

        # 1️⃣ Check if user already exists
        existing_user = self.db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )

        # 2️⃣ Check for existing unused invitation
        existing_invitation = self.db.query(Invitation).filter(
            Invitation.email == email,
            Invitation.used_at.is_(None),
            Invitation.expires_at > datetime.utcnow()
        ).first()
        if existing_invitation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Active invitation already exists for this email"
            )

        # Normalize role to lowercase for consistent enum matching
        normalized_role = role.lower()

        # Validate if the normalized_role is a valid UserRole member
        if normalized_role not in [role_enum.value for role_enum in UserRole]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role '{role}'. Must be one of: {', '.join([role_enum.value for role_enum in UserRole])}"
            )

        # 3️⃣ Handle customer creation/linking for CUSTOMER role
        if normalized_role == UserRole.CUSTOMER.value:
            if customer_id:
                # Link to existing customer
                customer = self.db.query(Customer).filter(Customer.customer_id == customer_id).first()
                if not customer:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Customer with ID {customer_id} not found."
                    )
                # Ensure the invited name is provided if linking to existing customer
                if not invited_name:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invited name is required when linking to an existing customer."
                    )
                user_full_name = invited_name
            else:
                # If customer_id is not provided, check if a customer with similar details already exists
                if not company_name or not company_address or not phone_number or not invited_name:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Company name, address, contact person, and phone number are required for new customer invitations."
                    )

                # Construct the full customer details string for searching
                input_company_details_str = f"{company_name}, {company_address}"
                normalized_input_company_details = input_company_details_str.strip().lower()

                # Search for an existing customer using case-insensitive and trimmed match on customer_details
                existing_customer = self.db.query(Customer).filter(
                    func.lower(func.trim(Customer.customer_details)) == normalized_input_company_details
                ).first()

                if existing_customer:
                    # Link to the existing customer found
                    customer = existing_customer
                    customer_id = customer.customer_id
                    user_full_name = invited_name
                else:
                    # Check if a customer with this email already exists (for new customer creation)
                    existing_customer_by_email = self.db.query(Customer).filter(Customer.email == email).first()
                    if existing_customer_by_email:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="A customer with this email already exists."
                        )

                    # Create new customer
                    customer = Customer(
                        customer_details=input_company_details_str,
                        contact_person=invited_name,
                        phone=phone_number,
                        email=email,
                        created_at=datetime.utcnow(),
                        is_active=True
                    )
                    self.db.add(customer)
                    self.db.flush()  # get customer_id before commit
                    customer_id = customer.customer_id
                    user_full_name = invited_name # For customer, full_name is the contact person
        else:
            # For staff/engineer/admin, invited_name is required
            if not invited_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invited name is required for staff, engineer, and admin roles."
                )
            customer_id = None
            user_full_name = invited_name

        # 4️⃣ Generate secure password and invitation token
        temp_password = generate_secure_password()
        temp_password_hash = hash_password(temp_password)
        invitation_token = create_invitation_token()

        # 5️⃣ Create user immediately
        username = email.split("@")[0]
        counter = 1
        original_username = username
        while self.db.query(User).filter(User.username == username).first():
            username = f"{original_username}{counter}"
            counter += 1

        user = User(
            username=username,
            email=email,
            full_name=user_full_name, # Use the determined full name
            password_hash=temp_password_hash,
            role=normalized_role,
            customer_id=customer_id,
            is_active=True
        )
        self.db.add(user)

        # 6️⃣ Create invitation record
        invitation = Invitation(
            email=email,
            token=invitation_token,
            user_role=normalized_role,
            invited_name=user_full_name, # Use the determined full name
            temp_password_hash=temp_password_hash,
            expires_at=datetime.utcnow() + timedelta(hours=48),
            created_by=created_by,
            customer_id=customer_id
        )
        self.db.add(invitation)

        self.db.commit()
        self.db.refresh(invitation)
        self.db.refresh(user)

        # 7️⃣ Send role-specific invitation email
        await send_general_invitation_email(
            background_tasks=background_tasks,
            email=email,
            name=user_full_name, # Use the determined full name for the email
            role=UserRole(normalized_role),
            temporary_password=temp_password,
            token=invitation_token,
            expires_hours=48,
            db=self.db, # Pass the database session for logging
            created_by=created_by # Pass the creator for logging
        )

        return {
            "message": "Invitation sent and user created successfully",
            "email": email,
            "role": role,
            "expires_at": invitation.expires_at
        }

    async def accept_invitation(self, token: str, new_password: str) -> UserResponse:
        """
        Accept an invitation by updating the user's password.
        The user record is already created at invitation time.
        """
        invitation = self.db.query(Invitation).filter(
            Invitation.token == token,
            Invitation.used_at.is_(None),
            Invitation.expires_at > datetime.utcnow()
        ).first()
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired invitation token"
            )

        # Update the user's password
        user = self.db.query(User).filter(User.email == invitation.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Associated user not found"
            )

        user.password_hash = hash_password(new_password)
        invitation.used_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(user)

        return UserResponse.from_orm(user)
