# Exercices pratiques et corrections

Réalisez d'abord chaque exercice sans lire immédiatement la correction. Notez vos observations dans votre portfolio.

## Exercice 1 — Déploiement initial

**Consigne :** démarrez les services, vérifiez leur état et appelez `/health`.

```bash
docker compose up -d --build
docker compose ps
curl -i http://localhost:8080/health
```

**Résultat attendu :** les trois services sont démarrés ; l'API répond `200` avec `{"status":"ok","database":"connected"}`.

**Correction / diagnostic :**
```bash
docker compose config
docker compose logs --tail=100 db api nginx
```
Si `db` n'est pas `healthy`, vérifiez les variables du `.env` et les logs PostgreSQL. Si `api` ne démarre pas, vérifiez les logs de construction et les variables `DB_*`.

## Exercice 2 — Ajouter un utilisateur

**Consigne :** ajoutez Camille, puis relisez la liste.

```bash
curl -i -X POST http://localhost:8080/users   -H 'Content-Type: application/json'   -d '{"name":"Camille","email":"camille@example.test"}'

curl -sS http://localhost:8080/users
```

**Résultat attendu :** HTTP `201`, puis Camille apparaît dans la liste.

**Correction / explication :** la route POST valide les champs et utilise une requête SQL paramétrée (`$1`, `$2`). Cela évite de concaténer directement les valeurs reçues dans la requête SQL. Une adresse déjà utilisée doit renvoyer HTTP `409`.

## Exercice 3 — Tester la validation

**Consigne :** envoyez une adresse e-mail invalide.

```bash
curl -i -X POST http://localhost:8080/users   -H 'Content-Type: application/json'   -d '{"name":"","email":"adresse-invalide"}'
```

**Résultat attendu :** HTTP `400`.

**Correction / explication :** l'API vérifie le type, la longueur et un format simple d'adresse e-mail avant d'interroger PostgreSQL.

## Exercice 4 — Démontrer la persistance

**Consigne :** ajoutez un utilisateur, supprimez les conteneurs sans supprimer les volumes, puis redémarrez.

```bash
docker compose down
docker compose up -d
curl -sS http://localhost:8080/users
```

**Résultat attendu :** l'utilisateur ajouté est toujours présent.

**Correction / explication :** les données résident dans `postgres_data`, monté sur `/var/lib/postgresql/data`. `docker compose down` ne supprime pas les volumes nommés.

**Contre-test destructif (facultatif) :** `docker compose down -v` supprime le volume. Après redémarrage, PostgreSQL initialise une base neuve et le script SQL d'initialisation insère Alice et Bob. Ne faites ce test qu'après avoir sauvegardé les données utiles.

## Exercice 5 — Vérifier l'exposition réseau

**Consigne :** inspectez les ports publiés.

```bash
docker compose ps
docker compose port nginx 80
docker compose port api 3000
docker compose port db 5432
```

**Résultat attendu :** Nginx expose le port hôte `8080`. Les commandes `port` pour l'API et PostgreSQL ne doivent pas afficher de mapping publié.

**Correction / explication :** aucun `ports:` n'est défini pour `api` et `db`. Les services communiquent par leurs réseaux Docker.

## Exercice 6 — Arrêter PostgreSQL

**Consigne :** arrêtez la base et observez l'état de santé de l'API.

```bash
docker compose stop db
docker compose ps
curl -i http://localhost:8080/health
docker compose logs --tail=50 api
```

**Résultat attendu :** l'API ne peut plus joindre la base ; `/health` renvoie HTTP `503` tant que PostgreSQL est indisponible.

**Correction / explication :** `/health` effectue une requête `SELECT 1`. Le contrôle de santé reflète donc la disponibilité de la dépendance PostgreSQL. Redémarrez ensuite la base :
```bash
docker compose start db
docker compose ps
```

## Exercice 7 — Sauvegarder et restaurer

**Consigne :** créez une sauvegarde SQL, puis restaurez-la.

```bash
./scripts/backup-db.sh
ls -lh backups/
```

Repérez le fichier créé, puis :
```bash
./scripts/restore-db.sh backups/NOM_DU_FICHIER.sql
```

**Résultat attendu :** le script demande de taper `RESTAURER` avant de lancer la restauration.

**Correction / explication :** `pg_dump` produit une sauvegarde SQL logique. Le script de restauration utilise `psql` avec `ON_ERROR_STOP=1`. Il est volontairement limité à un environnement pédagogique.

## Exercice 8 — Simuler une panne Nginx

**Consigne :** faites une copie de `nginx/default.conf`, modifiez temporairement `proxy_pass` pour utiliser un nom inexistant, puis recréez Nginx.

```bash
docker compose up -d --force-recreate nginx
curl -i http://localhost:8080/health
docker compose logs nginx
```

**Résultat attendu :** Nginx ne parvient plus à résoudre le service amont et renvoie une erreur `502` ou une erreur de résolution.

**Correction :** restaurez `proxy_pass http://api:3000;`, puis :
```bash
docker compose up -d --force-recreate nginx
curl -i http://localhost:8080/health
```

## Exercice 9 — Vérifier le dépôt Git

**Consigne :** vérifiez qu'aucun secret local ne sera publié.

```bash
git status --short
git check-ignore -v .env
```

**Résultat attendu :** `.env` est ignoré par Git. Seul `.env.example` est destiné au dépôt.

**Correction :** si `.env` a déjà été commité, le retirer du suivi avec `git rm --cached .env`, puis changer le mot de passe exposé. Ajouter `.env` au `.gitignore` ne retire pas un secret déjà présent dans l'historique Git.

## Barème suggéré

- Déploiement et fonctionnement : 20 points
- API et validation : 20 points
- Volumes et persistance : 20 points
- Réseaux et exposition : 15 points
- Sauvegarde/restauration : 15 points
- Documentation et GitHub : 10 points

Objectif portfolio : au moins 80/100, avec captures et explications des incidents.
