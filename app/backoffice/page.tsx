"use client";

import React, { useState, useRef } from "react";
import { nothingYouCouldDo } from "../font";
import "./page.scss";
import Cropper from "../components/cropper/Cropper";

export default function Backoffice() {
  const [imagesPreview, setImagesPreview] = useState<string[]>([]);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBigRectClick = () => {
    if (!imageToCrop) {
      fileInputRef.current?.click();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstImageUrl = URL.createObjectURL(files[0]);
      setImageToCrop(firstImageUrl);
      e.target.value = "";
    }
  };

  const handleCropCancel = () => {
    setImageToCrop(null);
  };

  const handleCropConfirm = (croppedDataUrl: string) => {
    setImagesPreview((prev) => [...prev, croppedDataUrl]);
    setImageToCrop(null);
  };

  return (
    <main className="backoffice">
      <section className="manage">
        <div className="conteneur">
          <h2 className={nothingYouCouldDo.className}>Ajouter</h2>
          <form>
            <div className="image">
              {/* Input fichier caché */}
              <input
                type="file"
                accept="image/*"
                multiple
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleImageChange}
              />

              {/* Miniatures des images validées */}
              {imagesPreview.length > 0 && (
                <div className="verfication">
                  {imagesPreview.map((src, idx) => (
                    <div key={idx} className="validate">
                      <img src={src} alt={`Miniature ${idx + 1}`} />
                    </div>
                  ))}
                </div>
              )}

              {/* Grand rectangle d'upload ou Cropper */}
              <div
                className="render"
                onClick={handleBigRectClick}
                role={!imageToCrop ? "button" : undefined}
                tabIndex={!imageToCrop ? 0 : undefined}
                aria-label="Ajouter une image"
              >
                {imageToCrop ? (
                  <Cropper
                    src={imageToCrop}
                    onCancel={handleCropCancel}
                    onConfirm={handleCropConfirm}
                  />
                ) : (
                  <span>Cliquez ici pour ajouter une image</span>
                )}
              </div>
            </div>

            {/* Autres champs du formulaire */}
            <div>
              <label htmlFor="name">Nom :</label>
              <input type="text" id="name" required />
            </div>

            <div>
              <label htmlFor="price">Prix (€) :</label>
              <input type="number" id="price" required min="0" step="1" />
            </div>

            <div>
              <label htmlFor="description">Description :</label>
              <textarea id="description" required />
            </div>

            <button type="submit">Ajouter</button>
          </form>
        </div>
      </section>
    </main>
  );
}
