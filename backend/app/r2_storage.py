import boto3
from botocore.client import Config
from fastapi import UploadFile
from .config import R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL, R2_BUCKET_NAME, R2_PUBLIC_URL
import io

# Initialize S3 client for R2
s3 = boto3.client(
    service_name='s3',
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    config=Config(signature_version='s3v4')
)

async def upload_image_to_r2(image: UploadFile, filename: str) -> str:
    try:
        # Use upload_fileobj for UploadFile which provides a file-like object
        s3.upload_fileobj(
            image.file, 
            R2_BUCKET_NAME,
            filename,
            ExtraArgs={
                'ContentType': image.content_type
            }
        )
        image_url = f"{R2_PUBLIC_URL}/{filename}"
        return image_url
    except Exception as e:
        print(f"Error uploading {filename} to R2: {str(e)}")
        raise

async def upload_image_bytes_to_r2(image_bytes: bytes, filename: str, content_type: str = 'image/png') -> str:
    """Uploads raw image bytes to R2."""
    try:
        # Use upload_fileobj with BytesIO for raw bytes
        s3.upload_fileobj(
            io.BytesIO(image_bytes),
            R2_BUCKET_NAME,
            filename,
            ExtraArgs={
                'ContentType': content_type
            }
        )
        image_url = f"{R2_PUBLIC_URL}/{filename}"
        return image_url
    except Exception as e:
        print(f"Error uploading bytes to R2 as {filename}: {str(e)}")
        raise

def get_image_from_r2(filename: str):
    """Get an image URL from R2
    
    Args:
        filename: The filename in R2 storage
        
    Returns:
        str: The URL to access the file
    """
    return f"{R2_PUBLIC_URL}/{R2_BUCKET_NAME}/{filename}"

def delete_image_from_r2(filename: str):
    """Delete an image from R2 storage
    
    Args:
        filename: The filename in R2 storage
    """
    s3.delete_object(Bucket=R2_BUCKET_NAME, Key=filename) 