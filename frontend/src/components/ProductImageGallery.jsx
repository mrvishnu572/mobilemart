import { useEffect, useMemo, useState } from "react";
import { getProductImageList } from "../utils/image-url.js";

export const ProductImageGallery = ({ product, alt = "Product image" }) => {
  const images = useMemo(() => getProductImageList(product), [product]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [failedImages, setFailedImages] = useState([]);
  const [pointer, setPointer] = useState({ x: 50, y: 50 });

  useEffect(() => {
    setActiveIndex(0);
    setFailedImages([]);
    setViewerOpen(false);
    setZoom(1);
  }, [product?._id]);

  useEffect(() => {
    if (!viewerOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowRight") setActiveIndex((index) => (index + 1) % Math.max(images.length, 1));
      if (event.key === "ArrowLeft") setActiveIndex((index) => (index - 1 + images.length) % Math.max(images.length, 1));
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [viewerOpen, images.length]);

  const availableImages = images.filter((image) => !failedImages.includes(image));
  const activeImage = images[activeIndex];
  const imageFailed = !activeImage || failedImages.includes(activeImage);
  const markFailed = (image) => {
    setFailedImages((current) => current.includes(image) ? current : [...current, image]);
    if (image === activeImage) {
      const nextIndex = images.findIndex((candidate, index) => index !== activeIndex && !failedImages.includes(candidate));
      if (nextIndex >= 0) setActiveIndex(nextIndex);
    }
  };

  const changeImage = (index) => {
    setActiveIndex(index);
    setZoom(1);
    setPointer({ x: 50, y: 50 });
  };

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    });
  };

  return (
    <>
      <div className="mm-gallery">
        <div className="mm-gallery-main-wrap">
          {imageFailed ? (
            <div className="mm-gallery-fallback"><span>▣</span><strong>Image unavailable</strong><small>Upload the product photo again from Admin → Phone Catalogue.</small></div>
          ) : (
            <button type="button" className="mm-gallery-main" onClick={() => { setViewerOpen(true); setZoom(1); }} onMouseMove={handlePointerMove} aria-label="Open image zoom viewer">
              <img src={activeImage} alt={alt} onError={() => markFailed(activeImage)} style={{ transformOrigin: `${pointer.x}% ${pointer.y}%` }} />
              <span className="mm-gallery-zoom-hint">⌕ Click to zoom</span>
            </button>
          )}
          {availableImages.length > 1 && <div className="mm-gallery-count">{Math.max(availableImages.indexOf(activeImage), 0) + 1} / {availableImages.length}</div>}
        </div>
        {availableImages.length > 1 && (
          <div className="mm-gallery-thumbnails" aria-label="Product photos">
            {images.map((image, index) => failedImages.includes(image) ? null : (
              <button type="button" key={`${image}-${index}`} className={index === activeIndex ? "mm-gallery-thumb active" : "mm-gallery-thumb"} onClick={() => changeImage(index)} aria-label={`Show product photo ${index + 1}`}>
                <img src={image} alt={`${alt} view ${index + 1}`} onError={() => markFailed(image)} />
              </button>
            ))}
          </div>
        )}
      </div>

      {viewerOpen && !imageFailed && (
        <div className="mm-image-viewer" role="dialog" aria-modal="true" aria-label="Product image viewer" onClick={() => setViewerOpen(false)}>
          <button type="button" className="mm-viewer-close" onClick={() => setViewerOpen(false)} aria-label="Close image viewer">×</button>
          {images.length > 1 && <button type="button" className="mm-viewer-arrow previous" onClick={(event) => { event.stopPropagation(); changeImage((activeIndex - 1 + images.length) % images.length); }} aria-label="Previous image">‹</button>}
          <div className="mm-viewer-stage" onClick={(event) => event.stopPropagation()}>
            <img src={activeImage} alt={alt} style={{ transform: `scale(${zoom})` }} onError={() => markFailed(activeImage)} />
          </div>
          {images.length > 1 && <button type="button" className="mm-viewer-arrow next" onClick={(event) => { event.stopPropagation(); changeImage((activeIndex + 1) % images.length); }} aria-label="Next image">›</button>}
          <div className="mm-viewer-controls" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))} disabled={zoom <= 1} aria-label="Zoom out">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))} disabled={zoom >= 3} aria-label="Zoom in">+</button>
            <button type="button" className="mm-viewer-reset" onClick={() => setZoom(1)}>Reset</button>
          </div>
          {images.length > 1 && <div className="mm-viewer-caption">Photo {activeIndex + 1} of {images.length}</div>}
        </div>
      )}
    </>
  );
};
