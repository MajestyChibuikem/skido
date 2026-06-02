import os
import logging

logger = logging.getLogger(__name__)


def _cloudinary_available():
    return bool(os.environ.get('CLOUDINARY_URL'))


def upload_snapshot(local_path: str, public_id: str) -> str | None:
    """Upload an annotated snapshot JPEG to Cloudinary and return its secure URL.

    Returns None when CLOUDINARY_URL is not set (local dev — caller keeps local file).
    """
    if not _cloudinary_available():
        return None

    try:
        import cloudinary
        import cloudinary.uploader

        result = cloudinary.uploader.upload(
            local_path,
            public_id=public_id,
            folder='agrocare/snapshots',
            overwrite=True,
            resource_type='image',
        )
        url = result.get('secure_url')
        logger.info("Snapshot uploaded to Cloudinary: %s", url)
        return url
    except Exception as exc:
        logger.warning("Cloudinary upload failed (%s), keeping local file", exc)
        return None
