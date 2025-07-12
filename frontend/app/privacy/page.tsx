import "./page.scss";
import { nothingYouCouldDo } from "../font";

export default function Mentions() {
    return (
        <main>
            <section className="privacy">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Politique de confidentialité</h2>
                    <div className="text">
                        <p>
                            La protection de vos données personnelles est une priorité pour EFFCRAFT. Nous nous engageons à respecter la confidentialité
                            des informations que vous nous confiez via notre site.
                        </p>
                        <div className="block">
                            <h3>1.Données collectées</h3>
                            <p>
                                Nous collectons uniquement les données nécessaires à la gestion de vos commandes et à la relation client : nom, prénom, adress
                                postale, e-mail, téléphone.
                            </p>
                        </div>
                        <div className="block">
                            <h3>2.Finalités du traitement</h3>
                            <p>
                               Ces données sont utilisées exclusivement pour traiter et expédier vos commandes, vous contacter en cas de besoin (suivi,
                               questions), respecter nos obligations légales (facturation, comptabilité).
                            </p>
                        </div>
                        <div className="block">
                            <h3>3.Durée de conservation</h3>
                            <p>
                                Vos données sont conservées pendant une durée maximale de 3 ans à compter de votre dernière commande, sauf obligation
                                légale contraire ou exercice de vos droits.
                            </p>
                        </div>
                        <div className="block">
                            <h3>4.Partage des données</h3>
                            <p>
                                Nous ne vendons ni ne cédons vos données à des tiers. Elles peuvent toutefois être communiquées à nos prestataires de livraison
                                ou de paiement dans le strict cadre de l’exécution de votre commande.
                            </p>
                        </div>
                        <div className="block">
                            <h3>5.Sécurité</h3>
                            <p>
                                Nous mettons en place des mesures techniques et organisationnelles adaptées pour protéger vos données contre tout accès non
                                autorisé, perte ou divulgation.
                            </p>
                        </div>
                        <div className="block">
                            <h3>6.Cookies et navigation</h3>
                            <p>
                                Nous utilisons des cookies nécessaires au fonctionnement du site ainsi que des cookies analytiques anonymes pour améliorer
                                votre expérience. Vous pouvez gérer vos préférences via la bannière cookies.
                            </p>
                        </div>
                        <div className="block">
                            <h3>7.Vos droits</h3>
                            <p>
                               Conformément au RGPD et à la loi « Informatique et Libertés », vous disposez d’un droit d’accès, de rectification, de suppression,
                               d’opposition, et de portabilité de vos données. Vous pouvez exercer ces droits à tout moment en nous contactant à : [adresse mail
                               de contact].
                            </p>
                        </div>
                        <div className="block">
                            <h3>8.Modifications de la politique</h3>
                            <p>
                                Cette politique peut être amenée à évoluer. Toute mise à jour sera publiée sur cette page avec la date de révision. Date de mise à
                                jour : [JJ/MM/AAAA]
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}