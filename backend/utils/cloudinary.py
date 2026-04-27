import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException
from ..config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


async def upload_image(
    file: UploadFile,
    folder: str = "sifra",
    transformation: list = None,
) -> str:
    """Upload an image to Cloudinary and return the secure URL."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size: 5MB")

    upload_params = {
        "folder": folder,
        "resource_type": "image",
    }
    if transformation:
        upload_params["transformation"] = transformation

    result = cloudinary.uploader.upload(contents, **upload_params)
    return result["secure_url"]


async def upload_avatar(file: UploadFile) -> str:
    return await upload_image(
        file,
        folder="sifra/avatars",
        transformation=[{"width": 200, "height": 200, "crop": "fill", "gravity": "face"}],
    )


async def upload_task_image(file: UploadFile) -> str:
    return await upload_image(
        file,
        folder="sifra/tasks",
        transformation=[{"width": 1200, "height": 800, "crop": "limit"}],
    )


async def upload_store_logo(file: UploadFile) -> str:
    return await upload_image(
        file,
        folder="sifra/store-logos",
        transformation=[{"width": 400, "height": 400, "crop": "fill"}],
    )


async def upload_store_banner(file: UploadFile) -> str:
    return await upload_image(
        file,
        folder="sifra/store-banners",
        transformation=[{"width": 1600, "height": 400, "crop": "fill"}],
    )


def delete_image(public_id: str):
    """Delete an image from Cloudinary by public_id."""
    cloudinary.uploader.destroy(public_id)
