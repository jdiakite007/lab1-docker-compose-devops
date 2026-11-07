# Guide de dépannage

Procédure de diagnostic à suivre dans l'ordre :

```bash
docker compose config
docker compose ps
docker compose logs --tail=100 nginx api db
```

## Le port 8080 est déjà utilisé

Symptôme : Docker ne peut pas publier `8080`.

Diagnostic :
```bash
sudo ss -ltnp | grep ':8080'
```
Solution : choisissez un autre port dans `docker-compose.yml`, par exemple `8081:80`, puis recréez Nginx.

## Le service API reste unhealthy

Diagnostic :
```bash
docker compose logs api
docker compose logs db
docker compose ps
```
Vérifiez :
- que PostgreSQL est `healthy` ;
- que les variables `DB_HOST`, `DB_NAME`, `DB_USER` et `DB_PASSWORD` correspondent ;
- que le code expose `/health` sur le port 3000 ;
- que la construction de l'image s'est terminée correctement.

## Nginx renvoie 502 Bad Gateway

Diagnostic :
```bash
docker compose logs nginx
docker compose logs api
docker compose exec nginx nginx -t
```
Vérifiez que l'API est saine et que `proxy_pass` cible `http://api:3000`. Le nom `api` doit être utilisé, pas `localhost` : dans le conteneur Nginx, `localhost` désigne le conteneur Nginx lui-même.

## PostgreSQL ne démarre pas

Diagnostic :
```bash
docker compose logs db
```
Vérifiez que le mot de passe est défini dans `.env` et que le fichier `.env` est présent à côté de `docker-compose.yml`. Si le volume contient déjà une base initialisée, changer `POSTGRES_PASSWORD` dans `.env` ne modifie pas automatiquement le mot de passe enregistré dans PostgreSQL.

## Les lignes du script SQL ne sont pas rejouées

Les scripts de `/docker-entrypoint-initdb.d` ne sont exécutés que lorsque le répertoire de données PostgreSQL est initialisé pour la première fois. Pour un laboratoire jetable, `docker compose down -v` permet de recréer une base vierge, mais détruit le volume. Sauvegardez d'abord les données nécessaires.

## L'API renvoie 409

L'adresse e-mail est déjà présente, car la colonne `email` est unique. Utilisez une autre adresse ou vérifiez la liste des utilisateurs.

## Le conteneur ne voit pas la base

L'API doit être connectée au réseau `backend`, PostgreSQL aussi, et `DB_HOST` doit être `db`. Les conteneurs Compose se découvrent par le nom du service sur un réseau partagé.
