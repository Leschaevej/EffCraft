"use client";

import React, { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { nothingYouCouldDo } from "../font";
import Card from "../components/card/Card";
import RelayMap from "../components/relayMap/RelayMap";
import type { RelayPoint } from "../components/relayMap/RelayMap";
import { Elements } from "@stripe/react-stripe-js";
import PaymentForm from "../components/payment/PaymentForm";
import { getStripePromise } from "../lib/stripe";
import "./page.scss";

const stripePromise = getStripePromise();
export type Bijou = {
    _id: string;
    name: string;
    price: number;
    images: string[];
    addedAt?: string;
};
export default function Cart() {
    const { data: session, status } = useSession();
    const [panier, setCart] = useState<Bijou[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showCheckout, setShowCheckout] = useState(false);
    const [showBillingForm, setShowBillingForm] = useState(false);
    const [showShippingMethod, setShowShippingMethod] = useState(false);
    const [showRecap, setShowRecap] = useState(false);
    const [sameAddress, setSameAddress] = useState(true);
    const [selectedShippingMethod, setSelectedShippingMethod] = useState<string | null>(null);
    const [shippingOptions, setShippingOptions] = useState<any[]>([]);
    const [loadingShipping, setLoadingShipping] = useState(false);
    const [showRelayMap, setShowRelayMap] = useState(false);
    const [relayPoints, setRelayPoints] = useState<RelayPoint[]>([]);
    const [selectedRelayPoint, setSelectedRelayPoint] = useState<RelayPoint | null>(null);
    const [loadingRelayPoints, setLoadingRelayPoints] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [billingAddressSuggestions, setBillingAddressSuggestions] = useState<any[]>([]);
    const [showBillingSuggestions, setShowBillingSuggestions] = useState(false);
    const [addressWarning, setAddressWarning] = useState<string | null>(null);
    const [showAddressConfirmDialog, setShowAddressConfirmDialog] = useState(false);
    const [addressConfirmed, setAddressConfirmed] = useState(false);
    const [billingAddressWarning, setBillingAddressWarning] = useState<string | null>(null);
    const [showBillingAddressConfirmDialog, setShowBillingAddressConfirmDialog] = useState(false);
    const autocompleteRef = React.useRef<HTMLDivElement>(null);
    const billingAutocompleteRef = React.useRef<HTMLDivElement>(null);
    const [formData, setFormData] = useState({
        nom: "",
        prenom: "",
        rue: "",
        complement: "",
        codePostal: "",
        ville: "",
        telephone: "",
    });
    const [billingData, setBillingData] = useState({
        nom: "",
        prenom: "",
        rue: "",
        complement: "",
        codePostal: "",
        ville: "",
    });
    const fetchCart = async () => {
        if (status === "loading") {
            return;
        }
        if (status !== "authenticated") {
            setLoading(false);
            return;
        }
        try {
            const res = await fetch("/api/user?type=cart", { credentials: "include" });
            const data = await res.json();
            if (res.ok) {
                setCart(data.cart);
                setErrorMessage(null);
            } else {
                setErrorMessage(data.error || "Erreur lors de la récupération du panier");
            }
        } catch {
            setErrorMessage("Erreur réseau lors de la récupération du panier");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (status !== "loading") {
            fetchCart();
        }
    }, [status]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
            if (billingAutocompleteRef.current && !billingAutocompleteRef.current.contains(event.target as Node)) {
                setShowBillingSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    useEffect(() => {
        const handleCartUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<{ type: string; productId: string }>;
            if (customEvent.detail.type === "product_available") {
                fetchCart();
                if (showCheckout) {
                    setShowCheckout(false);
                    setShowBillingForm(false);
                    setErrorMessage("Votre réservation a expiré. Veuillez ajouter à nouveau les produits à votre panier.");
                }
            }
        };
        window.addEventListener("cart-update", handleCartUpdate);
        return () => {
            window.removeEventListener("cart-update", handleCartUpdate);
        };
    }, [showCheckout]);
    const handleRemove = async (id: string) => {
        try {
        const res = await fetch("/api/user", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "remove_cart", productId: id }),
        });
        if (res.ok) {
            setCart((prev) => prev.filter((bijou) => bijou._id !== id));
            setErrorMessage(null);
        } else {
            const data = await res.json();
            setErrorMessage(data.error || "Erreur lors de la suppression");
        }
        } catch {
        setErrorMessage("Erreur réseau lors de la suppression");
        }
    };
    const totalPrix = panier.reduce((acc, bijou) => acc + bijou.price, 0);
    const isLoading = status === "loading" || (status === "authenticated" && loading);
    const searchAddress = async (query: string) => {
        if (query.length < 3) {
            setAddressSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        try {
            const response = await fetch(
                `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
            );
            const data = await response.json();
            setAddressSuggestions(data.features || []);
            if (data.features && data.features.length > 0) {
                setShowSuggestions(true);
            }
        } catch (error) {
            console.error("Erreur recherche adresse:", error);
        }
    };

    const selectAddress = (suggestion: any) => {
        const props = suggestion.properties;
        setFormData(prev => ({
            ...prev,
            rue: props.name || "",
            codePostal: props.postcode || "",
            ville: props.city || ""
        }));
        setShowSuggestions(false);
        setAddressSuggestions([]);
    };

    const searchBillingAddress = async (query: string) => {
        if (query.length < 3) {
            setBillingAddressSuggestions([]);
            setShowBillingSuggestions(false);
            return;
        }

        try {
            const response = await fetch(
                `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
            );
            const data = await response.json();
            setBillingAddressSuggestions(data.features || []);
            if (data.features && data.features.length > 0) {
                setShowBillingSuggestions(true);
            }
        } catch (error) {
            console.error("Erreur recherche adresse facturation:", error);
        }
    };

    const selectBillingAddress = (suggestion: any) => {
        const props = suggestion.properties;
        setBillingData(prev => ({
            ...prev,
            rue: props.name || "",
            codePostal: props.postcode || "",
            ville: props.city || ""
        }));
        setShowBillingSuggestions(false);
        setBillingAddressSuggestions([]);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Autocomplétion pour le champ "rue"
        if (name === "rue") {
            searchAddress(value);
        }
    };
    const handleBillingInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setBillingData(prev => ({ ...prev, [name]: value }));

        // Autocomplétion pour le champ "rue" de facturation
        if (name === "rue") {
            searchBillingAddress(value);
        }
    };
    const handleValidateOrder = () => {
        setShowCheckout(true);
    };
    const handleBackToCart = () => {
        setShowCheckout(false);
        setShowBillingForm(false);
        setShowShippingMethod(false);
        setShowRecap(false);
        setShowRelayMap(false);
    };
    const fetchRelayPoints = async (carrier: string) => {
        setLoadingRelayPoints(true);
        try {
            const params = new URLSearchParams({
                action: 'relay',
                address: formData.rue,
                zipcode: formData.codePostal,
                city: formData.ville,
                country: "FR",
                carrier: carrier
            });
            const response = await fetch(`/api/shipping?${params.toString()}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            if (!response.ok) {
                const error = await response.json();
                setErrorMessage(error.error || "Erreur lors de la récupération des points relais");
                return;
            }
            const data = await response.json();
            setRelayPoints(data.points || []);
            setShowRelayMap(true);
        } catch (error) {
            setErrorMessage("Erreur réseau lors de la récupération des points relais");
        } finally {
            setLoadingRelayPoints(false);
        }
    };
    const handleShippingMethodChange = async (optionId: string) => {
        setSelectedShippingMethod(optionId);
        setSelectedRelayPoint(null);
        const selectedOption = shippingOptions.find(opt => opt.id === optionId);
        if (selectedOption && selectedOption.type === "relay") {
            await fetchRelayPoints(selectedOption.operator);
        } else {
            setShowRelayMap(false);
        }
    };
    const handleSelectRelayPoint = (point: RelayPoint) => {
        setSelectedRelayPoint(point);
        setShowRelayMap(false);
    };

    const validateAddressBeforeContinue = async () => {
        setLoadingShipping(true);
        try {
            const params = new URLSearchParams({
                action: 'rates',
                address: formData.rue,
                zipcode: formData.codePostal,
                city: formData.ville,
                country: "FR"
            });
            const response = await fetch(`/api/shipping?${params.toString()}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            if (!response.ok) {
                const error = await response.json();
                setErrorMessage(error.error || "Erreur lors de la validation de l'adresse");
                setLoadingShipping(false);
                return false;
            }
            const data = await response.json();

            // Si l'adresse n'est pas reconnue, afficher la modal de confirmation
            if (data.addressWarning) {
                setAddressWarning(data.addressWarning);
                setShippingOptions(data.options || []); // Sauvegarder les options pour plus tard
                setShowAddressConfirmDialog(true);
                setLoadingShipping(false);
                return false; // Ne pas continuer
            }

            // Adresse validée, sauvegarder les options
            setShippingOptions(data.options || []);
            setLoadingShipping(false);
            return true; // Continuer
        } catch (error) {
            setErrorMessage("Erreur réseau lors de la validation de l'adresse");
            setLoadingShipping(false);
            return false;
        }
    };

    const handleConfirmAddress = async () => {
        setShowAddressConfirmDialog(false);
        setAddressConfirmed(true);
        // Passer à la page suivante (facturation ou mode de livraison)
        if (sameAddress) {
            setShowShippingMethod(true);
        } else {
            setShowBillingForm(true);
        }
    };

    const handleModifyAddress = () => {
        setShowAddressConfirmDialog(false);
        setAddressWarning(null);
        // Rester sur le formulaire de livraison
    };

    const validateBillingAddressBeforeContinue = async () => {
        setLoadingShipping(true);
        try {
            const params = new URLSearchParams({
                action: 'rates',
                address: billingData.rue,
                zipcode: billingData.codePostal,
                city: billingData.ville,
                country: "FR"
            });
            const response = await fetch(`/api/shipping?${params.toString()}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            if (!response.ok) {
                const error = await response.json();
                setErrorMessage(error.error || "Erreur lors de la validation de l'adresse de facturation");
                setLoadingShipping(false);
                return false;
            }
            const data = await response.json();

            // Si l'adresse n'est pas reconnue, afficher la modal de confirmation
            if (data.addressWarning) {
                setBillingAddressWarning(data.addressWarning);
                setShowBillingAddressConfirmDialog(true);
                setLoadingShipping(false);
                return false; // Ne pas continuer
            }

            setLoadingShipping(false);
            return true; // Continuer
        } catch (error) {
            setErrorMessage("Erreur réseau lors de la validation de l'adresse de facturation");
            setLoadingShipping(false);
            return false;
        }
    };

    const handleConfirmBillingAddress = async () => {
        setShowBillingAddressConfirmDialog(false);
        // Passer à la page mode de livraison
        setShowShippingMethod(true);
    };

    const handleModifyBillingAddress = () => {
        setShowBillingAddressConfirmDialog(false);
        setBillingAddressWarning(null);
        // Rester sur le formulaire de facturation
    };

    const handleContinueToBilling = async (e: React.FormEvent) => {
        e.preventDefault();

        // Valider l'adresse avant de continuer
        const isValid = await validateAddressBeforeContinue();

        if (isValid) {
            // L'adresse est validée, on peut continuer
            if (sameAddress) {
                setShowShippingMethod(true);
            } else {
                setShowBillingForm(true);
            }
        }
        // Sinon, la modal s'affiche automatiquement
    };

    const handleContinueToShipping = async (e: React.FormEvent) => {
        e.preventDefault();

        // Valider l'adresse de facturation avant de continuer
        const isValid = await validateBillingAddressBeforeContinue();

        if (isValid) {
            setShowShippingMethod(true);
        }
        // Sinon, la modal s'affiche automatiquement
    };
    const handleContinueFromShipping = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedShippingMethod) {
            setErrorMessage("Veuillez sélectionner un mode de livraison");
            return;
        }
        const selectedOption = shippingOptions.find(opt => opt.id === selectedShippingMethod);
        if (selectedOption && selectedOption.type === "relay") {
            if (!selectedRelayPoint) {
                await fetchRelayPoints(selectedOption.operator);
                return;
            }
        }
        setShowRecap(true);
        await createPaymentIntent();
    };
    const createPaymentIntent = async () => {
        try {
            const selectedOption = shippingOptions.find(opt => opt.id === selectedShippingMethod);
            const shippingPrice = selectedOption?.price || 0;
            const totalAmount = totalPrix + shippingPrice;
            const orderData = {
                products: panier,
                shippingData: {
                    ...formData,
                    shippingMethod: selectedOption ? {
                        operator: selectedOption.operator,
                        serviceCode: selectedOption.serviceCode,
                        relayPoint: selectedRelayPoint ? {
                            id: selectedRelayPoint.id,
                            name: selectedRelayPoint.name,
                            address: selectedRelayPoint.address,
                            zipcode: selectedRelayPoint.zipcode,
                            city: selectedRelayPoint.city,
                        } : undefined,
                    } : undefined,
                },
                billingData: sameAddress ? formData : billingData,
                totalAmount: totalAmount,
            };
            localStorage.setItem('pendingOrder', JSON.stringify(orderData));
            const response = await fetch("/api/payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: totalAmount }),
            });
            if (!response.ok) {
                const error = await response.json();
                setErrorMessage(error.error || "Erreur lors de la création du paiement");
                return;
            }
            const data = await response.json();
            setClientSecret(data.clientSecret);
        } catch (error) {
            setErrorMessage("Erreur réseau lors de la création du paiement");
        }
    };
    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
    };
    return (
        <main className={`cart ${status === "unauthenticated" ? "unloged" : ""}`}>
            <div className="conteneur">
                <h2 className={nothingYouCouldDo.className}>
                    {!showCheckout ? "Panier" : showRecap ? "Récapitulatif" : showShippingMethod ? "Mode de livraison" : showBillingForm ? "Facturation" : "Livraison"}
                </h2>
                {status === "unauthenticated" ? (
                    <>
                        <div className="login">
                            <p>Veuillez vous connecter pour voir votre panier !</p>
                            <button className="google" onClick={() => signIn("google")}>
                                <img src="/google.webp" alt="Google" />
                                Se connecter avec Google
                            </button>
                            <button className="facebook" onClick={() => alert("Connexion Facebook")}>
                                <img src="/facebook.webp" alt="Facebook" />
                                Se connecter avec Facebook
                            </button>
                            <button className="apple" onClick={() => alert("Connexion Apple")}>
                                <img src="/apple.webp" alt="Apple" />
                                Se connecter avec Apple
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {errorMessage && (
                            <div className="error" onClick={() => setErrorMessage(null)}>
                                {errorMessage}
                            </div>
                        )}
                        {showAddressConfirmDialog && (
                            <div className="modal-overlay" onClick={() => setShowAddressConfirmDialog(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                    <h3>Adresse non reconnue</h3>
                                    <div className="address-display">
                                        <strong>{formData.rue}</strong><br />
                                        <strong>{formData.codePostal} {formData.ville}</strong>
                                    </div>
                                    <div className="modal-actions">
                                        <button
                                            type="button"
                                            onClick={handleModifyAddress}
                                            className="modify"
                                        >
                                            Modifier l&apos;adresse
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmAddress}
                                            className="confirm"
                                        >
                                            Confirmer quand même
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {showBillingAddressConfirmDialog && (
                            <div className="modal-overlay" onClick={() => setShowBillingAddressConfirmDialog(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                    <h3>Adresse non reconnue</h3>
                                    <div className="address-display">
                                        <strong>{billingData.rue}</strong><br />
                                        <strong>{billingData.codePostal} {billingData.ville}</strong>
                                    </div>
                                    <div className="modal-actions">
                                        <button
                                            type="button"
                                            onClick={handleModifyBillingAddress}
                                            className="modify"
                                        >
                                            Modifier l&apos;adresse
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmBillingAddress}
                                            className="confirm"
                                        >
                                            Confirmer quand même
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {loading ? (
                            <div className="content">
                                <ul className="list">
                                    {Array.from({ length: 1 }, (_, i) => (
                                        <li key={`skeleton-${i}`} className="item cart-skeleton">
                                            <div className="image-skeleton" />
                                            <div className="text-skeleton name" />
                                            <div className="text-skeleton price" />
                                            <button className="remove" disabled style={{ opacity: 0.5 }}>
                                                Supprimer
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="total">
                                    <p>Total : <span className="price-skeleton" /></p>
                                    <button className="valider" disabled>Valider le panier</button>
                                </div>
                            </div>
                        ) : panier.length === 0 ? (
                            <div className="content">
                                <div className="empty-message">
                                    <p>Votre panier est vide.</p>
                                </div>
                                <div className="total">
                                    <p>Total : <strong>0 €</strong></p>
                                    <button
                                        className="valider"
                                        onClick={() => {
                                            sessionStorage.setItem("scrollToId", "product");
                                            window.location.href = "/";
                                        }}
                                    >
                                        Visiter notre collection
                                    </button>
                                </div>
                            </div>
                        ) : showRecap ? (
                        <div className="recap">
                            <div className="wrapper">
                                <div className="products">
                                    {panier.map((bijou) => (
                                        <div key={bijou._id} className="product">
                                            <Card
                                                bijou={bijou as any}
                                                clickable={false}
                                                showName={true}
                                                showPrice={true}
                                                showFavori={false}
                                                showArrows={false}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="addresses">
                                    <div className="address">
                                        <h3>Adresse de livraison</h3>
                                        <p>{formData.prenom} {formData.nom}</p>
                                        <p>{formData.rue}</p>
                                        {formData.complement && <p>{formData.complement}</p>}
                                        <p>{formData.codePostal} {formData.ville}</p>
                                        <p>{formData.telephone}</p>
                                        {selectedShippingMethod && (
                                            <div className="shipping-info">
                                                <p>Mode de livraison : {shippingOptions.find(opt => opt.id === selectedShippingMethod)?.name}</p>
                                                {selectedRelayPoint && (() => {
                                                    const toTitleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                                                    return (
                                                        <>
                                                            <p>{toTitleCase(selectedRelayPoint.name)}</p>
                                                            <p>{toTitleCase(selectedRelayPoint.address)}</p>
                                                            <p>{selectedRelayPoint.zipcode} {toTitleCase(selectedRelayPoint.city)}</p>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                    {!sameAddress && (
                                        <div className="address">
                                            <h3>Adresse de facturation</h3>
                                            <p>{billingData.prenom} {billingData.nom}</p>
                                            <p>{billingData.rue}</p>
                                            {billingData.complement && <p>{billingData.complement}</p>}
                                            <p>{billingData.codePostal} {billingData.ville}</p>
                                        </div>
                                    )}
                                </div>
                                <button type="button" onClick={() => setShowRecap(false)}>
                                    Retour
                                </button>
                            </div>
                            <div className="summary">
                                <div className="line">
                                    <span>Articles</span>
                                    <span>{totalPrix.toFixed(2)} €</span>
                                </div>
                                <div className="line">
                                    <span>Livraison</span>
                                    <span>
                                        {selectedShippingMethod ?
                                            shippingOptions.find(opt => opt.id === selectedShippingMethod)?.price.toFixed(2)
                                            : "0.00"} €
                                    </span>
                                </div>
                                <div className="line total">
                                    <span><strong>Total</strong></span>
                                    <span>
                                        <strong>{(totalPrix + (selectedShippingMethod ?
                                            shippingOptions.find(opt => opt.id === selectedShippingMethod)?.price || 0
                                            : 0)).toFixed(2)} €</strong>
                                    </span>
                                </div>
                                {clientSecret && stripePromise ? (
                                    <Elements
                                        stripe={stripePromise}
                                        options={{
                                            clientSecret,
                                            loader: 'never',
                                            appearance: {
                                                variables: {
                                                    colorPrimary: getComputedStyle(document.documentElement).getPropertyValue('--mainColor').trim() || '#6F826A',
                                                    colorBackground: getComputedStyle(document.documentElement).getPropertyValue('--secondBackgroundColor').trim() || '#ffffff',
                                                    colorText: getComputedStyle(document.documentElement).getPropertyValue('--mainTextColor').trim() || '#24191C',
                                                    colorDanger: getComputedStyle(document.documentElement).getPropertyValue('--secondErrorColor').trim() || '#df1b41',
                                                    borderRadius: '20px',
                                                    spacingUnit: '4px',
                                                },
                                                rules: {
                                                    '.AccordionItem': {
                                                        border: `3px solid ${getComputedStyle(document.documentElement).getPropertyValue('--mainColor').trim() || '#6F826A'}`,
                                                        backgroundColor: 'transparent',
                                                        color: getComputedStyle(document.documentElement).getPropertyValue('--mainTextColor').trim() || '#24191C',
                                                        boxShadow: 'none',
                                                    },
                                                    '.AccordionItem:hover': {
                                                        backgroundColor: 'rgba(111, 130, 106, 0.1)',
                                                    },
                                                    '.AccordionItem--selected': {
                                                        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--mainColor').trim() || '#6F826A',
                                                        color: getComputedStyle(document.documentElement).getPropertyValue('--secondTextColor').trim() || '#ffffff',
                                                        border: `3px solid ${getComputedStyle(document.documentElement).getPropertyValue('--mainColor').trim() || '#6F826A'}`,
                                                    },
                                                    '.AccordionItem--selected:hover': {
                                                        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--mainColor').trim() || '#6F826A',
                                                    },
                                                    '.Label': {
                                                        color: getComputedStyle(document.documentElement).getPropertyValue('--secondTextColor').trim() || '#ffffff',
                                                    },
                                                    '.Input': {
                                                        color: getComputedStyle(document.documentElement).getPropertyValue('--mainTextColor').trim() || '#24191C',
                                                    },
                                                    '.Error': {
                                                        fontSize: '0px',
                                                        margin: '0',
                                                        padding: '0',
                                                        lineHeight: '0',
                                                    },
                                                },
                                            },
                                        }}
                                    >
                                        <PaymentForm
                                            clientSecret={clientSecret}
                                            userEmail={session?.user?.email || ''}
                                            onSuccess={() => {
                                                alert("Paiement réussi !");
                                            }}
                                            onError={(error) => {
                                                setErrorMessage(error);
                                            }}
                                        />
                                    </Elements>
                                ) : !stripePromise ? (
                                    <div className="loading">Configuration Stripe en attente...</div>
                                ) : null}
                            </div>
                        </div>
                        ) : showShippingMethod ? (
                        <div className="shipping">
                            <form onSubmit={handleContinueFromShipping}>
                                {loadingShipping ? (
                                    <p>Calcul des frais de port en cours...</p>
                                ) : shippingOptions.length === 0 ? (
                                    <p>Aucune option de livraison disponible.</p>
                                ) : (
                                    <div className="list">
                                        {shippingOptions.map((option) => (
                                            <div key={option.id} className={`method ${selectedShippingMethod === option.id ? 'selected' : ''}`}>
                                                <label className="head">
                                                    <input
                                                        type="radio"
                                                        name="shippingMethod"
                                                        value={option.id}
                                                        checked={selectedShippingMethod === option.id}
                                                        onChange={(e) => handleShippingMethodChange(e.target.value)}
                                                        required
                                                    />
                                                    <div className="info">
                                                        {option.logo && <img src={option.logo} alt={option.name} className="logo" />}
                                                        <p>{option.service}</p>
                                                        <p className="price">{option.price.toFixed(2)} €</p>
                                                    </div>
                                                </label>
                                                {selectedShippingMethod === option.id && option.type === "relay" && (
                                                    <>
                                                        {showRelayMap ? (
                                                            <div className="selector">
                                                                <h3>Choisissez votre point relais</h3>
                                                                {loadingRelayPoints ? (
                                                                    <p>Chargement des points relais...</p>
                                                                ) : relayPoints.length === 0 ? (
                                                                    <p>Aucun point relais trouvé à proximité.</p>
                                                                ) : (
                                                                    <RelayMap
                                                                        points={relayPoints}
                                                                        center={[
                                                                            relayPoints[0]?.latitude || 43.5297,
                                                                            relayPoints[0]?.longitude || 5.4474
                                                                        ]}
                                                                        onSelectPoint={handleSelectRelayPoint}
                                                                        selectedPointId={selectedRelayPoint?.id}
                                                                    />
                                                                )}
                                                            </div>
                                                        ) : selectedRelayPoint && (
                                                            <div className="relaySelected">
                                                                <div>
                                                                    <h4>Point relais sélectionné :</h4>
                                                                    <p><strong>{selectedRelayPoint.name}</strong></p>
                                                                    <p>{selectedRelayPoint.address}</p>
                                                                    <p>{selectedRelayPoint.zipcode} {selectedRelayPoint.city}</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowRelayMap(true)}
                                                                >
                                                                    Changer de point relais
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="actions">
                                    <button type="button" onClick={() => setShowShippingMethod(false)}>
                                        Retour
                                    </button>
                                    <button type="submit" className="confirm">
                                        Continuer
                                    </button>
                                </div>
                            </form>
                        </div>
                        ) : !showCheckout ? (
                <div className="content">
                    <ul className="list">
                        {panier.map((bijou) => (
                            <li key={bijou._id} className="item">
                                    <Card
                                    bijou={bijou as any}
                                    clickable={false}
                                    showName={false}
                                    showPrice={false}
                                    showFavori={false}
                                    showArrows={false}
                                    />
                                    <h3>{bijou.name}</h3>
                                    <p>{bijou.price} €</p>
                                    <button onClick={() => handleRemove(bijou._id)} className="remove">
                                    Supprimer
                                    </button>
                            </li>
                        ))}
                    </ul>
                    <div className="total">
                        <p>Total : <strong>{totalPrix} €</strong></p>
                        <button className="valider" onClick={handleValidateOrder}>Valider le panier</button>
                    </div>
                </div>
                        ) : !showBillingForm ? (
                <div className="checkout">
                    <form onSubmit={handleContinueToBilling}>
                        <div className="name">
                            <input
                                type="text"
                                name="nom"
                                placeholder="Nom"
                                value={formData.nom}
                                onChange={handleInputChange}
                                autoComplete="family-name"
                                pattern="[A-Za-zÀ-ÿ\s\-']+"
                                minLength={2}
                                title="Le nom ne doit contenir que des lettres, espaces, tirets et apostrophes"
                                required
                            />
                            <input
                                type="text"
                                name="prenom"
                                placeholder="Prénom"
                                value={formData.prenom}
                                onChange={handleInputChange}
                                autoComplete="given-name"
                                pattern="[A-Za-zÀ-ÿ\s\-']+"
                                minLength={2}
                                title="Le prénom ne doit contenir que des lettres, espaces, tirets et apostrophes"
                                required
                            />
                        </div>
                        <div className="address-autocomplete" ref={autocompleteRef}>
                            <input
                                type="text"
                                name="rue"
                                placeholder="Rue (commencez à taper pour des suggestions)"
                                value={formData.rue}
                                onChange={handleInputChange}
                                autoComplete="off"
                                required
                            />
                            {showSuggestions && addressSuggestions.length > 0 && (
                                <ul className="suggestions">
                                    {addressSuggestions.map((suggestion, index) => (
                                        <li
                                            key={index}
                                            onClick={() => selectAddress(suggestion)}
                                        >
                                            <strong>{suggestion.properties.name}</strong>
                                            <span>{suggestion.properties.postcode} {suggestion.properties.city}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="street">
                            <input
                                type="text"
                                name="complement"
                                placeholder="Complément d'adresse (optionnel)"
                                value={formData.complement}
                                onChange={handleInputChange}
                                autoComplete="address-line2"
                            />
                            <input
                                type="text"
                                name="codePostal"
                                placeholder="Code postal"
                                value={formData.codePostal}
                                onChange={handleInputChange}
                                autoComplete="postal-code"
                                pattern="[0-9]{5}"
                                maxLength={5}
                                title="Le code postal doit contenir exactement 5 chiffres"
                                required
                            />
                        </div>
                        <div className="city">
                            <input
                                type="text"
                                name="ville"
                                placeholder="Ville"
                                value={formData.ville}
                                onChange={handleInputChange}
                                autoComplete="address-level2"
                                pattern="[A-Za-zÀ-ÿ\s\-']+"
                                minLength={2}
                                title="La ville ne doit contenir que des lettres, espaces, tirets et apostrophes"
                                required
                            />
                            <input
                                type="tel"
                                name="telephone"
                                placeholder="Téléphone (10 chiffres)"
                                value={formData.telephone}
                                onChange={handleInputChange}
                                autoComplete="tel"
                                pattern="[0-9]{10}"
                                maxLength={10}
                                title="Le téléphone doit contenir exactement 10 chiffres"
                                required
                            />
                        </div>
                        <div className="billing">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={sameAddress}
                                    onChange={(e) => setSameAddress(e.target.checked)}
                                />
                                Utiliser la même adresse pour la facturation
                            </label>
                        </div>
                        <div className="action">
                            <button type="button" onClick={handleBackToCart}>
                                Retour
                            </button>
                            <button type="submit" className="confirm">
                                Continuer
                            </button>
                        </div>
                    </form>
                </div>
                        ) : (
                <div className="checkout">
                    <form onSubmit={handleContinueToShipping}>
                        <div className="name">
                            <input
                                type="text"
                                name="nom"
                                placeholder="Nom"
                                value={billingData.nom}
                                onChange={handleBillingInputChange}
                                autoComplete="family-name"
                                pattern="[A-Za-zÀ-ÿ\s\-']+"
                                minLength={2}
                                title="Le nom ne doit contenir que des lettres, espaces, tirets et apostrophes"
                                required
                            />
                            <input
                                type="text"
                                name="prenom"
                                placeholder="Prénom"
                                value={billingData.prenom}
                                onChange={handleBillingInputChange}
                                autoComplete="given-name"
                                pattern="[A-Za-zÀ-ÿ\s\-']+"
                                minLength={2}
                                title="Le prénom ne doit contenir que des lettres, espaces, tirets et apostrophes"
                                required
                            />
                        </div>
                        <div className="address-autocomplete" ref={billingAutocompleteRef}>
                            <input
                                type="text"
                                name="rue"
                                placeholder="Rue"
                                value={billingData.rue}
                                onChange={handleBillingInputChange}
                                autoComplete="off"
                                required
                            />
                            {showBillingSuggestions && billingAddressSuggestions.length > 0 && (
                                <ul className="suggestions">
                                    {billingAddressSuggestions.map((suggestion, index) => (
                                        <li
                                            key={index}
                                            onClick={() => selectBillingAddress(suggestion)}
                                        >
                                            <strong>{suggestion.properties.name}</strong>
                                            <span>{suggestion.properties.postcode} {suggestion.properties.city}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="street">
                            <input
                                type="text"
                                name="complement"
                                placeholder="Complément d'adresse (optionnel)"
                                value={billingData.complement}
                                onChange={handleBillingInputChange}
                                autoComplete="address-line2"
                            />
                            <input
                                type="text"
                                name="codePostal"
                                placeholder="Code postal"
                                value={billingData.codePostal}
                                onChange={handleBillingInputChange}
                                autoComplete="postal-code"
                                pattern="[0-9]{5}"
                                maxLength={5}
                                title="Le code postal doit contenir exactement 5 chiffres"
                                required
                            />
                        </div>
                        <div className="city">
                            <input
                                type="text"
                                name="ville"
                                placeholder="Ville"
                                value={billingData.ville}
                                onChange={handleBillingInputChange}
                                autoComplete="address-level2"
                                pattern="[A-Za-zÀ-ÿ\s\-']+"
                                minLength={2}
                                title="La ville ne doit contenir que des lettres, espaces, tirets et apostrophes"
                                required
                            />
                        </div>
                        <div className="action">
                            <button type="button" onClick={() => setShowBillingForm(false)}>
                                Retour
                            </button>
                            <button type="submit" className="confirm">
                                Continuer
                            </button>
                        </div>
                    </form>
                </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}