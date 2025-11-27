"use client";

import React, { useState, useRef, useEffect } from "react";
import Select from "react-select";
import "./AddForm.scss";
import Cropper from "../cropper/Cropper";

interface CategoryOption {
  value: string;
  label: string;
}
const categoryOptions: CategoryOption[] = [
  { value: "necklace", label: "Collier" },
  { value: "earrings", label: "Boucle d'oreille" },
];
const MAX_IMAGES = 4;

interface AddFormProps {
  onProductAdded?: () => void;
}

export default function AddForm({ onProductAdded }: AddFormProps) {
  const [imagesPreview, setImagesPreview] = useState<string[]>([]);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null);
  const [errors, setErrors] = useState({
    name: false,
    price: false,
    description: false,
    category: false,
    images: false,
  });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleBigRectClick = () => {
    if (!imageToCrop && imagesPreview.length < MAX_IMAGES) {
      fileInputRef.current?.click();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (imagesPreview.length >= MAX_IMAGES) {
      e.target.value = "";
      return;
    }
    const firstImageUrl = URL.createObjectURL(files[0]);
    setImageToCrop(firstImageUrl);
    e.target.value = "";
    if (errors.images) setErrors((prev) => ({ ...prev, images: false }));
  };

  const handleCropCancel = () => {
    setImageToCrop(null);
  };

  const handleCropConfirm = (croppedDataUrl: string) => {
    setImagesPreview((prev) => [...prev, croppedDataUrl]);
    setImageToCrop(null);
  };

  const handleRemoveImage = (index: number) => {
    setImagesPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCategoryChange = (option: CategoryOption | null) => {
    setSelectedCategory(option);
    if (errors.category) setErrors((prev) => ({ ...prev, category: false }));
    if (submitSuccess) setSubmitSuccess(false);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errors.name) setErrors((prev) => ({ ...prev, name: false }));
    if (submitSuccess) setSubmitSuccess(false);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errors.price) setErrors((prev) => ({ ...prev, price: false }));
    if (submitSuccess) setSubmitSuccess(false);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (errors.description) setErrors((prev) => ({ ...prev, description: false }));
    if (submitSuccess) setSubmitSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const priceRaw = (form.elements.namedItem("price") as HTMLInputElement).value.trim();
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value.trim();
    const category = selectedCategory ? selectedCategory.value : null;

    const newErrors = {
      name: name === "",
      price: priceRaw === "" || isNaN(parseFloat(priceRaw)),
      description: description === "",
      category: category === null,
      images: imagesPreview.length === 0,
    };
    setErrors(newErrors);

    const hasError = Object.values(newErrors).some(Boolean);
    if (hasError) return;

    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: parseFloat(priceRaw),
          description,
          category,
          images: imagesPreview,
        }),
      });
      await res.json();

      form.reset();
      setSelectedCategory(null);
      setImagesPreview([]);
      setSubmitSuccess(true);

      timeoutRef.current = setTimeout(() => {
        setSubmitSuccess(false);
      }, 1000);

      if (onProductAdded) onProductAdded();
    } catch (err) {
      // Erreur silencieuse
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="addForm" onSubmit={handleSubmit} noValidate>
      <div className="image">
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleImageChange}
        />
        <div className="verfication">
          {imagesPreview.length === 0 ? (
            <div className="placeholder" />
          ) : (
            imagesPreview.map((src, idx) => (
              <div key={idx} className="validate">
                <img src={src} alt={`Miniature ${idx + 1}`} />
                <button
                  type="button"
                  className="remove"
                  aria-label={`Supprimer l'image ${idx + 1}`}
                  onClick={() => handleRemoveImage(idx)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <div
          className={`render ${errors.images ? "error" : ""}`}
          onClick={handleBigRectClick}
          role={!imageToCrop && imagesPreview.length < MAX_IMAGES ? "button" : undefined}
          tabIndex={!imageToCrop && imagesPreview.length < MAX_IMAGES ? 0 : undefined}
          aria-label="Ajouter une image"
        >
          {imageToCrop ? (
            <Cropper src={imageToCrop} onCancel={handleCropCancel} onConfirm={handleCropConfirm} />
          ) : imagesPreview.length >= MAX_IMAGES ? (
            <span>Limite atteinte (4 images max)</span>
          ) : (
            <span>Cliquez ici pour ajouter une image</span>
          )}
        </div>
      </div>

      <div>
        <input
          type="text"
          id="name"
          name="name"
          required
          placeholder="Nom du produit"
          autoComplete="off"
          className={errors.name ? "error" : ""}
          onChange={handleNameChange}
        />
      </div>

      <div className="priceCategory">
        <input
          type="number"
          id="price"
          name="price"
          required
          min="0"
          step="1"
          placeholder="Prix (€)"
          autoComplete="off"
          className={errors.price ? "error" : ""}
          onChange={handlePriceChange}
        />
        <div className={`select-wrapper ${errors.category ? "error" : ""}`}>
          <Select
            className="custom-select"
            classNamePrefix="custom-select"
            options={categoryOptions}
            value={selectedCategory}
            onChange={handleCategoryChange}
            placeholder="Catégorie"
            name="category"
            inputId="category"
            instanceId="category-select"
          />
        </div>
      </div>

      <div>
        <textarea
          id="description"
          name="description"
          required
          placeholder="Description"
          autoComplete="off"
          className={errors.description ? "error" : ""}
          onChange={handleDescriptionChange}
        />
      </div>

      <button className="send" type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? "Envoi en cours..."
          : submitSuccess
          ? "Bijoux ajouté à la collection"
          : "Ajouter"}
      </button>
    </form>
  );
}