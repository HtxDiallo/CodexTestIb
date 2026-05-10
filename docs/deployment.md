# Déploiement VoucherRADIUS sur le VPS

Cette application est un MVP Next.js inspire de la maquette fournie. Elle presente les ecrans metier et les actions attendues cote administration. La version deployee sur le VPS est branchee sur MariaDB et les tables SQL FreeRADIUS.

## Cible VPS

- Hôte : `vps-eb0c35d2.vps.ovh.net`
- Utilisateur : `ubuntu`
- FreeRADIUS installe : `3.0.26`
- Base : `MariaDB`, database `radius`
- Module : `freeradius-mysql`
- Ports RADIUS : UDP `1812` et `1813`

## Architecture cible

```text
pfSense 1  ─┐
pfSense 2  ─┼──> FreeRADIUS + PostgreSQL/MySQL ───> VoucherRADIUS Web
pfSense 3  ─┘
```

## Integration FreeRADIUS SQL

1. Installer le module SQL FreeRADIUS adapte a la base choisie.
2. Creer les tables officielles FreeRADIUS : `radcheck`, `radreply`, `radacct`, `nas`.
3. Creer les tables applicatives du fichier `database/mysql-app-schema.sql`.
4. Lorsqu'un voucher est cree, ecrire :
   - `radcheck.username = code`
   - `radcheck.attribute = Cleartext-Password`
   - `radcheck.value = code`
   - les règles de durée/débit dans `radreply`
5. Lorsqu'un pfSense/NAS est ajoute, ecrire aussi l'entree dans la table `nas`.
6. Lire `radacct` pour afficher les connexions, durees utilisees, NAS, IP et MAC.

## Services installes

```bash
systemctl status voucherradius
systemctl status nginx
systemctl status freeradius
systemctl status mariadb
```

Le mot de passe MariaDB de l'application est conserve sur le serveur dans :

```text
/etc/voucherradius.env
```

Le mot de passe brut genere est aussi conserve en root-only dans :

```text
/etc/voucherradius-db-pass
```

## Déploiement Node/Nginx

L'application peut tourner sur `127.0.0.1:3000` via `npm run start`, puis être exposée par Nginx sur le port `80`.
