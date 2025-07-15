import "./page.scss";
import { nothingYouCouldDo } from "../font";

export default function Mentions() {
    return (
        <main>
            <section className="terms">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>CGV</h2>
                    <div className="text">
                        <p>
                            Les présentes Conditions Générales de Vente (CGV) régissent toutes les commandes passées sur le site effcraft.com, édité par la
                            société EFFCRAFT, dont le siège est situé à [adresse], immatriculée au R.C.S sous le numéro [numéro]. En validant une commande,
                            le Client accepte sans réserve les présentes CGV.
                        </p>
                        <div className="block">
                            <h3>1.Produits</h3>
                            <p>
                                Chaque bijou est fabriqué artisanalement, rendant chaque pièce totalement unique. Les photos présentées servent d’illustration et
                                reflètent l’esprit de la création, mais chaque bijou comporte ses propres particularités. Chaque pièce est disponible à l’unité,
                                assurant ainsi son exclusivité.
                            </p>
                        </div>
                        <div className="block">
                            <h3>2.Prix</h3>
                            <p>
                                Les prix sont indiqués en euros, TVA non applicable selon l’article 293B du CGI, hors frais de livraison. Le vendeur se réserve le
                                droit de modifier ses prix à tout moment. Les produits sont facturés sur la base des tarifs en vigueur au moment de la validation
                                et du paiement de la commande.
                            </p>
                        </div>
                        <div className="block">
                            <h3>3.Commande</h3>
                            <p>
                                Toute commande implique l’acceptation des présentes CGV. Le Client doit fournir des informations exactes lors de l’inscription et
                                de la commande. Un e-mail de confirmation récapitulant la commande sera envoyé au Client.
                            </p>
                        </div>
                        <div className="block">
                            <h3>4.Paiement</h3>
                            <p>
                                Le paiement s’effectue en ligne via des moyens sécurisés (carte bancaire, PayPal, etc.). La commande sera traitée uniquement
                                après validation du paiement. Le Client autorise expressément le débit de son compte bancaire pour le montant de la commande.
                            </p>
                        </div>
                        <div className="block">
                            <h3>5.Livraison</h3>
                            <p>
                                Les livraisons sont effectuées en France et en Europe par un transporteur choisi par le vendeur. Les délais de livraison sont
                                indicatifs et ne sauraient engager la responsabilité du vendeur en cas de retard imputable au transporteur. Le Client doit fournir
                                une adresse de livraison complète et exacte. Toute anomalie ou dommage constaté à la réception doit être signalé au transporteur
                                et au vendeur dans un délai de 5 jours ouvrés.
                            </p>
                        </div>
                        <div className="block">
                            <h3>6.Droit de rétractation</h3>
                            <p>
                                Conformément à la loi, le Client dispose d’un délai de 14 jours à compter de la réception du produit pour exercer son droit de
                                rétractation sans pénalité, à l’exception des articles personnalisés qui ne sont ni repris ni échangés. Le produit doit être retourné
                                dans son état d’origine, complet et emballé correctement.
                            </p>
                        </div>
                        <div className="block">
                            <h3>7.Retours et remboursements</h3>
                            <p>
                               Les frais de retour sont à la charge du Client sauf en cas de produit défectueux ou non conforme. Le remboursement s’effectuera
                               après réception et vérification des produits retournés, via le même mode de paiement que celui utilisé pour la commande.
                            </p>
                        </div>
                        <div className="block">
                            <h3>8.Responsabilité</h3>
                            <p>
                                EFFCRAFT ne pourra être tenue responsable des dommages résultant d’une mauvaise utilisation des produits, d’un retard
                                de livraison dû au transporteur, ou de toute force majeure empêchant l’exécution des commandes.
                            </p>
                        </div>
                        <div className="block">
                            <h3>9.Données personnelles</h3>
                            <p>
                                Les informations collectées sont nécessaires au traitement des commandes et sont protégées conformément à la réglementation
                                en vigueur. Elles ne sont jamais transmises à des tiers.
                            </p>
                        </div>
                        <div className="block">
                            <h3>10.Propriété intellectuelle</h3>
                            <p>
                                Tous les contenus présents sur le site (textes, images, logos) sont la propriété exclusive d’EFFCRAFT et protégés par le droit de la
                                propriété intellectuelle.
                            </p>
                        </div>
                        <div className="block">
                            <h3>11.Loi applicable et juridiction compétente</h3>
                            <p>
                                Les présentes CGV sont régies par la loi française. En cas de litige, les parties tenteront une résolution amiable avant tout recours
                                judiciaire. À défaut d’accord amiable, les tribunaux français seront seuls compétents.
                            </p>
                        </div>
                        <div className="block">
                            <h3>12.Modifications des CGV</h3>
                            <p>
                                EFFCRAFT se réserve le droit de modifier à tout moment les présentes CGV. Les CGV applicables sont celles en vigueur au moment
                                de la validation de la commande.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}