# Product image upload and return-only update

## Admin product photos
- Admins can select up to 8 JPG, PNG, or WEBP images from their computer.
- Each image must be 5 MB or smaller.
- Images are stored in `backend/uploads` and served from `/uploads`.
- The first uploaded image is used as the main product image and as the default variant image.
- Product image uploads require an authenticated admin account.

## Storage note
This implementation uses local filesystem storage. It is suitable for local development and single-server deployments with a persistent disk. For deployments with ephemeral filesystems or multiple backend instances, configure a persistent volume or object storage (for example S3/Cloudinary) before production use.

## Returns
The customer-facing flow now submits return requests only. Exchange selection and replacement variant selection have been removed. Existing historical exchange records remain readable in the database; new exchange requests are rejected by the API.

## Run
Start the backend and frontend as usual. Ensure the backend process can write to `backend/uploads`.
