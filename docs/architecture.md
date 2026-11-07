# Architecture du laboratoire

## Flux réseau

1. Le client accède au port `8080` de l'hôte.
2. Docker transmet la requête au port `80` du service Nginx.
3. Nginx résout le nom DNS Docker `api` sur le réseau `frontend`.
4. L'API interroge le nom DNS `db` sur le réseau `backend`.
5. PostgreSQL stocke les données dans le volume nommé `postgres_data`.

## Segmentation

| Service | Réseau frontend | Réseau backend | Port publié sur l'hôte |
|---|---:|---:|---:|
| nginx | Oui | Non | 8080 |
| api | Oui | Oui | Aucun |
| db | Non | Oui | Aucun |

Le réseau `backend` est `internal: true`. Cette séparation limite l'exposition réseau de la base de données. Elle ne remplace pas les contrôles de sécurité de l'hôte ni une politique de sécurité complète.

## Persistance

Le volume `postgres_data` contient les fichiers de données PostgreSQL. Un conteneur peut être supprimé puis recréé sans supprimer ce volume. La suppression du volume (`docker compose down -v`) efface les données du laboratoire.
