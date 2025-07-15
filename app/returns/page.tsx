import "./page.scss";
import { nothingYouCouldDo } from "../font";

export default function Mentions() {
    return (
        <main>
            <section className="return">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Retour & échanges</h2>
                    <div className="text">
                        <p>
                            Nous espérons que votre bijou vous apportera entière satisfaction. Si toutefois vous souhaitez effectuer un retour, voici notre
                            politique :
                        </p>
                        <div className="block">
                            <h3>1. Délai</h3>
                            <p>
                                Vous disposez de 14 jours à compter de la réception pour nous retourner un article qui ne vous conviendrait pas.
                            </p>
                        </div>
                        <div className="block">
                            <h3>2.Conditions</h3>
                            <p>
                                Le produit doit être retourné dans son état d’origine : non porté, intact et dans son emballage d’origine. Les bijoux personnalisés
                                ne sont pas remboursables ni échangeables. Merci de bien emballer votre article afin de garantir un traitement optimal de votre
                                retour. Si vous recevez un produit cassé ou endommagé, vous pouvez également le retourner. Dans ce cas, vous disposez d’un
                                délai de 3 jours à compter de la réception pour nous contacter et effectuer le retour. Tout produit retourné endommagé ou cassé
                                sans signalement dans ce délai ne pourra malheureusement pas être remboursé ou échangé.
                            </p>
                        </div>
                        <div className="block">
                            <h3>3.Frais de retour</h3>
                            <p>
                                Les frais de retour sont à votre charge. Nous vous conseillons d’utiliser un envoi suivi et un emballage soigné, pour éviter tout
                                dommage pendant le transport.
                            </p>
                        </div>
                        <div className="block">
                            <h3>4.Remboursement</h3>
                            <p>
                                Après réception et contrôle du produit, nous procéderons au remboursement via le moyen de paiement utilisé lors de votre
                                commande. Si le produit est reçu en mauvais état, le remboursement ne pourra pas être effectué.
                            </p>
                        </div>
                        <div className="block">
                            <h3>5.Demander un retour</h3>
                            <p>
                                Pour effectuer un retour, merci de cliquer sur le bouton Retour dans la section Commande / Historique de votre compte. Veuillez
                                préciser le motif du retour. Nous vous indiquerons la marche à suivre pour le renvoi de votre article.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}