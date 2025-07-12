import "./page.scss";
import { nothingYouCouldDo } from "../font";

export default function Mentions() {
    return (
        <main>
            <section className="mention">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Mentions légales</h2>
                    <div className="text">
                        <p>
                            Conformément aux articles 6-III et 19 de la Loi n°2004-575 du 21 juin 2004 pour la Confiance dans l’économie numérique (L.C.E.N.), 
                            il est porté à la connaissance des utilisateurs du site <strong>EFFCRAFT</strong> les informations suivantes :</p>
                        <p>
                            L’éditeur du site est la société <strong>EFFCRAFT</strong>.  
                            Statut juridique : [Auto-entrepreneur / Micro-entreprise / SASU, etc.].  
                            SIRET : [XXXXXXXXXXXXX].  
                            Siège social : [Adresse complète].  
                            Téléphone : [Numéro].  
                            E-mail : [Adresse de contact].  
                            Directeur de la publication : [Nom et prénom du responsable légal].
                        </p>
                        <p>
                            Le site est hébergé par <strong>Vercel Inc.</strong>, dont l’adresse est 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
                        </p>
                        <p>
                            Ce site a été réalisé avec la technologie <strong>Next.js</strong> et est hébergé sur la plateforme <strong>Vercel</strong>.
                        </p>
                        <p>
                            Tous les éléments présents sur ce site (textes, images, logos, créations, produits, marques, etc.) sont la propriété exclusive de <strong>EFFCRAFT</strong>, sauf mention contraire. Toute reproduction, représentation ou exploitation non autorisée, partielle ou totale, est strictement interdite.
                        </p>
                        <p>
                            EFFCRAFT s’efforce d’assurer l’exactitude et la mise à jour des informations sur ce site, sans pouvoir garantir l’exhaustivité ou l’absence d’erreur. L’accès peut être interrompu à tout moment pour maintenance ou raison technique.
                        </p>
                        <p>
                            Les utilisateurs sont informés que la sécurité des échanges sur Internet ne peut être totalement garantie. Il leur appartient de protéger leurs données personnelles.
                        </p>
                        <p>
                            Ces mentions légales sont soumises au droit français. En cas de litige, les tribunaux français sont compétents.
                        </p>
                        <p>
                            Dernière mise à jour : [JJ/MM/AAAA].
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}