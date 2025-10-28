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
    const [loadingPayment, setLoadingPayment] = useState(false);
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
        fetchCart();
    }, [status]);
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
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleBillingInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setBillingData(prev => ({ ...prev, [name]: value }));
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
            const response = await fetch("/api/shipping/relay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address: formData.rue,
                    zipcode: formData.codePostal,
                    city: formData.ville,
                    country: "FR",
                    carrier: carrier
                })
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
    const fetchShippingRates = async () => {
        setLoadingShipping(true);
        try {
            const response = await fetch("/api/shipping/price", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to_address: {
                        zipcode: formData.codePostal,
                        city: formData.ville,
                        address: formData.rue,
                        country: "FR",
                        firstname: formData.prenom,
                        lastname: formData.nom,
                        email: session?.user?.email || "client@example.com",
                        phone: formData.telephone
                    },
                    items_count: panier.length,
                    total_value: totalPrix
                })
            });
            if (!response.ok) {
                const error = await response.json();
                setErrorMessage(error.error || "Erreur lors du calcul des frais de port");
                return;
            }
            const data = await response.json();
            setShippingOptions(data.options || []);
        } catch (error) {
            setErrorMessage("Erreur réseau lors du calcul des frais de port");
        } finally {
            setLoadingShipping(false);
        }
    };
    const handleContinueToBilling = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sameAddress) {
            setShowShippingMethod(true);
            await fetchShippingRates();
        } else {
            setShowBillingForm(true);
        }
    };
    const handleContinueToShipping = async (e: React.FormEvent) => {
        e.preventDefault();
        setShowShippingMethod(true);
        await fetchShippingRates();
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
        setLoadingPayment(true);
        try {
            const selectedOption = shippingOptions.find(opt => opt.id === selectedShippingMethod);
            const shippingPrice = selectedOption?.priceWithTax || 0;
            const totalAmount = totalPrix + shippingPrice;
            const orderData = {
                products: panier,
                shippingData: {
                    ...formData,
                    relayPoint: selectedRelayPoint,
                },
                billingData: sameAddress ? formData : billingData,
                shippingMethod: selectedOption,
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
        } finally {
            setLoadingPayment(false);
        }
    };
    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
    };
    if (isLoading) {
        return <p>Chargement du panier...</p>;
    }
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
                        {panier.length === 0 ? (
                            <p>Votre panier est vide.</p>
                        ) : showRecap ? (
                        <div className="recap">
                            <div className="wrapper">
                                <div className="products">
                                    {panier.map((bijou) => (
                                        <div key={bijou._id} className="product">
                                            <div className="image">
                                                <img src={bijou.images[0]} alt={bijou.name} />
                                            </div>
                                            <p className="name">{bijou.name}</p>
                                            <p className="price">{bijou.price} €</p>
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
                                        {selectedRelayPoint && (
                                            <>
                                                <h4>Point relais :</h4>
                                                <p><strong>{selectedRelayPoint.name}</strong></p>
                                                <p>{selectedRelayPoint.address}</p>
                                                <p>{selectedRelayPoint.zipcode} {selectedRelayPoint.city}</p>
                                            </>
                                        )}
                                    </div>
                                    <div className="address">
                                        <h3>Adresse de facturation</h3>
                                        {sameAddress ? (
                                            <>
                                                <p>{formData.prenom} {formData.nom}</p>
                                                <p>{formData.rue}</p>
                                                {formData.complement && <p>{formData.complement}</p>}
                                                <p>{formData.codePostal} {formData.ville}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p>{billingData.prenom} {billingData.nom}</p>
                                                <p>{billingData.rue}</p>
                                                {billingData.complement && <p>{billingData.complement}</p>}
                                                <p>{billingData.codePostal} {billingData.ville}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
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
                                            shippingOptions.find(opt => opt.id === selectedShippingMethod)?.priceWithTax.toFixed(2)
                                            : "0.00"} €
                                    </span>
                                </div>
                                <div className="line total">
                                    <span><strong>Total</strong></span>
                                    <span>
                                        <strong>{(totalPrix + (selectedShippingMethod ?
                                            shippingOptions.find(opt => opt.id === selectedShippingMethod)?.priceWithTax || 0
                                            : 0)).toFixed(2)} €</strong>
                                    </span>
                                </div>
                                {loadingPayment ? (
                                    <div className="loading">Préparation du paiement...</div>
                                ) : clientSecret && stripePromise ? (
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
                                            <React.Fragment key={option.id}>
                                                <label
                                                    className={`method ${selectedShippingMethod === option.id ? 'selected' : ''}`}
                                                >
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
                                                        <p className="price">{option.priceWithTax.toFixed(2)} €</p>
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
                                                            <div className="selected">
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
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                                <div className="actions">
                                    <button type="button" onClick={() => setShowShippingMethod(false)} className="back">
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
                                <div className="image">
                                    <Card
                                    bijou={bijou as any}
                                    clickable={false}
                                    showName={false}
                                    showPrice={false}
                                    showFavori={false}
                                    />
                                </div>
                                <div className="info">
                                    <h3>{bijou.name}</h3>
                                    <p>{bijou.price} €</p>
                                    <button onClick={() => handleRemove(bijou._id)} className="remove">
                                    Supprimer
                                    </button>
                                </div>
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
                                required
                            />
                            <input
                                type="text"
                                name="prenom"
                                placeholder="Prénom"
                                value={formData.prenom}
                                onChange={handleInputChange}
                                autoComplete="given-name"
                                required
                            />
                        </div>
                        <input
                            type="text"
                            name="rue"
                            placeholder="Rue"
                            value={formData.rue}
                            onChange={handleInputChange}
                            autoComplete="address-line1"
                            required
                        />
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
                                required
                            />
                            <input
                                type="tel"
                                name="telephone"
                                placeholder="Téléphone"
                                value={formData.telephone}
                                onChange={handleInputChange}
                                autoComplete="tel"
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
                            <button type="button" onClick={handleBackToCart} className="back">
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
                                required
                            />
                            <input
                                type="text"
                                name="prenom"
                                placeholder="Prénom"
                                value={billingData.prenom}
                                onChange={handleBillingInputChange}
                                autoComplete="given-name"
                                required
                            />
                        </div>
                        <input
                            type="text"
                            name="rue"
                            placeholder="Rue"
                            value={billingData.rue}
                            onChange={handleBillingInputChange}
                            autoComplete="address-line1"
                            required
                        />
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
                                required
                            />
                        </div>
                        <div className="action">
                            <button type="button" onClick={() => setShowBillingForm(false)} className="back">
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