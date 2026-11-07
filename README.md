# LAB 01 — Infrastructure Web DevOps avec Docker Compose

**Niveau :** débutant avancé / intermédiaire  
**Durée indicative :** 6 à 10 heures  
**Technologies :** Ubuntu Server, Docker, Docker Compose, Nginx, Node.js, Express, PostgreSQL, Git.

Ce laboratoire déploie une petite application web en trois services :
- **Nginx** : point d'entrée HTTP et reverse proxy ;
- **API Node.js / Express** : logique applicative ;
- **PostgreSQL** : stockage persistant des utilisateurs.

Le but est de pratiquer le déploiement, le réseau entre conteneurs, la persistance, les contrôles de santé, les sauvegardes, les tests et le dépannage.

> Ce projet est un laboratoire pédagogique. Avant une mise en production, ajoutez HTTPS, une gestion de secrets adaptée, des sauvegardes externalisées, des mises à jour maîtrisées, des limites de ressources et une stratégie de supervision.

## 1. Architecture

```text
Navigateur / client HTTP
        |
        | http://localhost:8080
        v
+---------------------+
| Nginx : port 80     |  publié sur l'hôte : 8080
| reverse proxy       |
+---------------------+
        |
        | réseau frontend
        v
+---------------------+
| API Node.js : 3000  |
| /health, /users     |
+---------------------+
        |
        | réseau backend (interne)
        v
+---------------------+
| PostgreSQL : 5432   |
| volume postgres_data|
+---------------------+
```

Seul Nginx publie un port sur l'hôte. L'API et PostgreSQL ne publient pas de port. PostgreSQL est uniquement joignable depuis le réseau Docker `backend`. Le volume nommé `postgres_data` conserve les données quand les conteneurs sont supprimés avec `docker compose down`.

## 2. Prérequis

- Une VM Ubuntu Server 24.04 LTS (2 vCPU, 4 Go RAM et 25 Go disque minimum pour ce lab).
- Un compte autorisé à utiliser Docker.
- Un accès Internet pour télécharger les images et dépendances.
- Git.

Installation Docker : https://docs.docker.com/engine/install/ubuntu/

Vérification :
```bash
docker --version
docker compose version
git --version
```

Sur Ubuntu, si votre compte n'est pas dans le groupe `docker`, utilisez `sudo` devant les commandes Docker ou configurez l'accès conformément à la documentation Docker. L'appartenance au groupe `docker` donne des privilèges élevés sur l'hôte.

## 3. Démarrage rapide

```bash
cp .env.example .env
```

Éditez `.env` et remplacez impérativement le mot de passe d'exemple par une valeur propre au laboratoire.

```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f
```

Tester depuis la VM :
```bash
curl -i http://localhost:8080/health
curl -i http://localhost:8080/users
```

Réponse attendue de `/health` :
```json
{"status":"ok","database":"connected"}
```

Réponse attendue de `/users` : un tableau JSON contenant Alice et Bob, initialisés lors de la première création du volume.

## 4. Arborescence

```text
lab1-docker-compose-devops/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── README.md
├── api/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── server.js
├── db/
│   └── init/
│       └── 01-init.sql
├── nginx/
│   └── default.conf
├── scripts/
│   ├── backup-db.sh
│   └── restore-db.sh
└── docs/
    ├── architecture.md
    ├── exercises-and-solutions.md
    └── troubleshooting.md
```

## 5. Configuration et fichiers

Les fichiers de ce dépôt constituent la configuration complète. Consultez-les directement ; les explications des choix techniques sont ci-dessous.

### Variables d'environnement

- `.env.example` est un modèle sans secret réel.
- `.env` contient les valeurs locales et ne doit jamais être commité.
- Le mot de passe est transmis au conteneur par variable d'environnement pour ce lab. Pour un environnement réel, privilégiez les secrets Docker ou un gestionnaire de secrets.

### Initialisation PostgreSQL

Le script `db/init/01-init.sql` est exécuté automatiquement par l'image officielle PostgreSQL lors de l'initialisation d'un **répertoire de données vide**. Il crée la table `users` et insère deux lignes de démonstration. Modifier ce script après la création du volume ne réexécute pas automatiquement son contenu.

### Réseaux

- `frontend` relie Nginx et l'API.
- `backend` relie l'API et PostgreSQL et est déclaré `internal: true`.
- Les noms de services (`api`, `db`) servent de noms DNS dans les réseaux Docker.

### Persistance

Le volume `postgres_data` est monté sur `/var/lib/postgresql/data`. `docker compose down` supprime les conteneurs et réseaux du projet, mais conserve le volume. `docker compose down -v` supprime également le volume et donc les données du laboratoire.

## 6. Commandes d'exploitation

```bash
# État des services
docker compose ps

# Journaux de tous les services
docker compose logs --tail=100
docker compose logs -f api
docker compose logs -f db
docker compose logs -f nginx

# Redémarrer un service
docker compose restart api

# Reconstruire l'API après modification du code
docker compose up -d --build api

# Vérifier les réseaux et volumes
docker network ls
docker volume ls
docker volume inspect lab1-docker-compose-devops_postgres_data

# Ouvrir un shell PostgreSQL
docker compose exec db psql -U labuser -d labdb

# Arrêter sans supprimer les données
docker compose down

# ATTENTION : supprime aussi les données persistantes du projet
docker compose down -v
```

Le nom réel du volume dépend du nom de projet Compose. Vérifiez-le avec `docker volume ls`.

## 7. Tests fonctionnels

### Vérifier la santé de l'application
```bash
curl -sS http://localhost:8080/health
```

### Lire les utilisateurs
```bash
curl -sS http://localhost:8080/users
```

### Ajouter un utilisateur
```bash
curl -i -X POST http://localhost:8080/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Charlie","email":"charlie@example.test"}'
```

### Vérifier l'ajout
```bash
curl -sS http://localhost:8080/users
```

### Vérifier la validation des données
```bash
curl -i -X POST http://localhost:8080/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"","email":"pas-une-adresse"}'
```
Une requête invalide doit retourner HTTP 400.

### Vérifier la persistance
1. Ajouter Charlie.
2. Exécuter `docker compose down`.
3. Exécuter `docker compose up -d`.
4. Appeler `/users` : Charlie doit toujours être présent.

### Vérifier l'isolation
```bash
docker compose ps
```
Aucun port PostgreSQL ni API ne doit être publié sur l'hôte. Seul le port `8080` de Nginx apparaît dans la colonne PORTS.

## 8. Sauvegarde et restauration

Créer une sauvegarde SQL :
```bash
mkdir -p backups
./scripts/backup-db.sh
```

Le script écrit un fichier horodaté dans `backups/`. Vérifiez qu'il n'est pas vide :
```bash
ls -lh backups/
```

Restaurer une sauvegarde :
```bash
./scripts/restore-db.sh backups/nom-du-fichier.sql
```

**Attention :** le script de restauration remplace les tables `users` et `users_id_seq` du laboratoire. Il demande une confirmation interactive. N'utilisez pas ces scripts sur une base de production.

## 9. Dépannage

Consultez `docs/troubleshooting.md`. Commencez toujours par :
```bash
docker compose ps
docker compose logs --tail=100 api db nginx
docker compose config
```

## 10. Publication sur GitHub

Depuis la racine du projet :
```bash
git init
git add .
git status
```

Vérifiez que `.env` n'apparaît pas dans la liste des fichiers à commiter. Puis :
```bash
git commit -m "Initial commit: Docker Compose DevOps lab"
git branch -M main
git remote add origin https://github.com/VOTRE-UTILISATEUR/lab1-docker-compose-devops.git
git push -u origin main
```

Ajoutez ensuite au dépôt :
- des captures d'écran de `docker compose ps` ;
- des réponses de l'API ;
- une preuve de persistance après recréation ;
- une capture de la sauvegarde et de la restauration ;
- les incidents rencontrés et leur résolution.

Ne publiez jamais de mot de passe, jeton, adresse IP publique sensible ou donnée d'entreprise.

## 11. Critères de réussite

- [ ] Les trois services démarrent.
- [ ] Nginx transmet les requêtes à l'API.
- [ ] `/health` confirme l'accès à PostgreSQL.
- [ ] GET `/users` renvoie les utilisateurs.
- [ ] POST `/users` ajoute un utilisateur.
- [ ] Les entrées persistent après `docker compose down` puis `up`.
- [ ] PostgreSQL n'est pas publié sur l'hôte.
- [ ] Une sauvegarde SQL est créée et restaurable.
- [ ] Le dépôt Git ne contient pas `.env`.
- [ ] Le README permet à une autre personne de reproduire le laboratoire.

## 12. Pour aller plus loin

1. Ajouter HTTPS avec un certificat de laboratoire.
2. Ajouter des tests automatisés de l'API.
3. Construire un workflow GitHub Actions.
4. Ajouter Prometheus et Grafana.
5. Ajouter des limites CPU/RAM et une politique de mise à jour des images.
