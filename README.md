# 🌿 EffCraft

Site e-commerce de **EffCraft**, bijoux artisanaux en bois sculptés à la main.

> 🚧 **Projet en cours de développement**

🔗 **[Voir le site en ligne](https://effcraft.fr)**

![Aperçu du site EffCraft](./public/effcraft.webp)

![Next.js](https://img.shields.io/badge/Next.js-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![SCSS](https://img.shields.io/badge/SCSS-CC6699?logo=sass&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000?logo=vercel&logoColor=white)

---

## 📋 À propos

Boutique en ligne pour une artisane créant des bijoux en bois uniques, sculptés à la main à partir de matériaux recyclés ou de récupération. Le site permet de parcourir les créations, passer commande avec paiement sécurisé, et suivre les événements/marchés à venir.

## ✨ Fonctionnalités

- **Design responsive** — Adapté à tous les écrans (mobile, tablette, desktop)
- **Catalogue produits** — Carrousel interactif avec filtres par catégorie (boucles d'oreilles, colliers)
- **Panier & paiement** — Système de commande complet avec paiement sécurisé via Stripe
- **Authentification** — Connexion via Google (NextAuth) avec gestion des favoris
- **Back-office admin** — Gestion des produits, commandes et événements
- **Événements** — Calendrier et carte interactive des marchés à venir (Leaflet)
- **Temps réel** — Notifications en temps réel via Pusher (stock, commandes)
- **Livraison** — Gestion des expéditions via Boxtal (Mondial Relay, Relais Colis)
- **Formulaire de contact** — Envoi d'emails via Nodemailer
- **Gestion des images** — Upload et optimisation via Cloudinary

## 🛠️ Stack technique

| Catégorie | Technologie |
|-----------|------------|
| Framework | Next.js |
| Langage | TypeScript |
| Styles | SCSS |
| Base de données | MongoDB / Mongoose |
| Authentification | NextAuth (Google) |
| Paiement | Stripe |
| Images | Cloudinary |
| Carte | Leaflet / React-Leaflet |
| Temps réel | Pusher |
| Livraison | Boxtal (Mondial Relay, Relais Colis) |
| Emails | Nodemailer |
| Data fetching | SWR |
| Hébergement | Vercel |

## 🚀 Installation

```bash
# Cloner le repo
git clone https://github.com/Leschaevej/EffCraft.git

# Accéder au dossier
cd EffCraft

# Installer les dépendances et lancer le serveur
npm start
```

## 🔧 Variables d'environnement

Créer un fichier `.env` à la racine du projet :

```env
MONGODB_URI=               # URI de connexion MongoDB
CLOUDINARY_CLOUD_NAME=     # Nom du cloud Cloudinary
CLOUDINARY_API_KEY=        # Clé API Cloudinary
CLOUDINARY_API_SECRET=     # Secret API Cloudinary
GOOGLE_CLIENT_ID=          # Client ID Google OAuth
GOOGLE_CLIENT_SECRET=      # Secret Google OAuth
NEXTAUTH_URL=              # URL du site
NEXTAUTH_SECRET=           # Secret NextAuth
ADMIN_EMAILS=              # Emails admin (séparés par des virgules)

BOXTAL_ENV=                # Environnement Boxtal (test / prod)
BOXTAL_V3_TEST_KEY=        # Clé API Boxtal test
BOXTAL_V3_TEST_SECRET=     # Secret API Boxtal test
BOXTAL_V3_PROD_KEY=        # Clé API Boxtal prod
BOXTAL_V3_PROD_SECRET=     # Secret API Boxtal prod
BOXTAL_WEBHOOK_TOKEN=      # Token webhook Boxtal
COMPANY_NAME=              # Nom de l'entreprise
SHIPPER_FIRST_NAME=        # Prénom expéditeur
SHIPPER_LAST_NAME=         # Nom expéditeur
SHIPPER_EMAIL=             # Email expéditeur
SHIPPER_PHONE=             # Téléphone expéditeur
SHIPPER_NUMBER=            # Numéro de rue expéditeur
SHIPPER_STREET=            # Rue expéditeur
SHIPPER_CITY=              # Ville expéditeur
SHIPPER_POSTAL_CODE=       # Code postal expéditeur
SHIPPER_COUNTRY=           # Pays expéditeur (FR)
MONDIAL_RELAY_PICKUP_CODE= # Code point relais Mondial Relay
RELAIS_COLIS_PICKUP_CODE=  # Code point relais Relais Colis

NEXT_PUBLIC_STRIPE_ENV=    # Environnement Stripe (test / prod)
STRIPE_ENV=                # Environnement Stripe (test / prod)
NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY=  # Clé publique Stripe test
STRIPE_TEST_SECRET_KEY=    # Clé secrète Stripe test
NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY=  # Clé publique Stripe prod
STRIPE_PROD_SECRET_KEY=    # Clé secrète Stripe prod

PUSHER_APP_ID=             # App ID Pusher
PUSHER_KEY=                # Clé Pusher
PUSHER_SECRET=             # Secret Pusher
PUSHER_CLUSTER=            # Cluster Pusher (eu)
NEXT_PUBLIC_PUSHER_KEY=    # Clé publique Pusher
NEXT_PUBLIC_PUSHER_CLUSTER= # Cluster publique Pusher

MAIL_USER=                 # Adresse email pour l'envoi
MAIL_PASSWORD=             # Mot de passe email
```

## 📄 Licence

Ce projet est sous licence propriétaire — Tous droits réservés. Voir [LICENSE](./LICENSE) pour plus de détails.
