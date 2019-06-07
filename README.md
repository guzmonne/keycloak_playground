# README.md

## Let's Encrypt

Para habilitar HTTPS en un sitio se necesita un certificado de un `Certificate Authority (CA)`. Let's Encrypt es un `CA`. Let's Encrypt puede proveerte un certificado si uno demustra que es dueño de su dominio.
Esto lo hace siguiendo el [protocolo ACME](https://ietf-wg-acme.github.io/acme/).

### Development

Cuando se esta probando un sistema de renovación de certificados utilizando el protocolo ACME es recomendable utilizar el `Staging Environment` de Let's Encrypt. Esto permite conseguir el flujo correcto sin llegar a los límites fijados por Let's Encrypt en el ambiente de producción.

La URL para el `Staging Environment` es:

```
https://acme-staging-v02.api.letsencrypt.org/directory
```

Los certificados emitidos en este ambiente con se encuentran dentro de los browsers. No se pueden utilizar para servir páginas web.

### ¿Como funciona?

En dos pasos. Primero el agente prueba que es dueño del dominio. Luego, puede pedir, renovar, y revocar certificados para ese dominio.

Let's Encrypt identifica al administrador del sistema por su clave pública. En su primera interacción, demuestra que controla uno o más dominios. 

Para empezar, el agente le pregunta a Let's Encrypt que `challenges` debe superar para demostrar que es dueño del dominio. Por ejemplo:

1. Crear un recurso DNS sobre el dominio en cuestión.
2. Crear un recurso HTTP bajo una `well-known URI` sobre el dominio planteado.

![https://letsencrypt.org/images/howitworks_challenge.png](https://letsencrypt.org/images/howitworks_challenge.png)

El agente completa algúno de estos `challenges` y le avisa al CA para que lo constate. Una vez que lo valida el agente esta en condiciones de administrar los certificados.

Para obtener un certificado para el dominio, el agente construye un [`PKCS#10 Certificate Signing Request`](https://tools.ietf.org/html/rfc2986) pidiendo el certificado. El CSR incluye una firma por la llave privada correspondiente a la llave pública en el CSR. El agente además firma el CSR entero con la llave autorizada para el dominio, de manera que Let's Encrypt sepa que esta autorizado.

El CA verífica el pedido y si todo esta bien, emite el certificado. Este certificado **será valido por 90 días. Es recomendado actualizar este certificado cada 60 días.**

La revocación se realiza de forma similar.

Si se quieren emitir certificados `wildcard` -por ejemplo para dominios de tipo `*.example.com`- se pueden realizar utilizando ACME v2. El endpoint de producción para esto es el siguiente:

```
https://acme-v02.api.letsencrypt.org/directory
```

**Los certificados `wildcard` solo pueden realizarlo utilizando el `challenge` DNS-01.**

### Let's Encrypt con Ansible

El módulo actual para crear y renovar certificados de Let's Encrypt con Ansible se llama `acme_certificate`. 

Para que funcione, tiene que ejecutarse al menos dos veces. Ya sea como dos tareas independientes, o como dos ejecuciones independientes. Es importante notar que la salida de la primera ejecución debe pasarse en el argumento `data` de la segunda ejecución.

Es importante notar que el módulo `acme_certificate` no se encarga de resolver el los `challenges`. Esto debe ser realizado aparte, sobre Ansible o no.

Para funcionar requiere:

- `python` >= 2.6
- `openssl` o `cryptography` >= 1.5

Algunos parámetros importantes:

- `account_email`: Dirección de correo sobre la cual se enviarán las alertas de expiración de certificados.
- `account_key_src`: Path al archivo que contien la llave privada para utilizar con el protocolo ACME. La llave puede ser creada con el comando `openssl genrsa ...`.
- `acme_directory`: El directorio de ACME a utilizar. Por defecto esta configurado el directorio de staging de ACME v1. Se recomienda configurarlos con la URL `https://acme-staging-v02.api.letsencrypt.org/directory` que corresponde al directorio de staging de ACMEv2. Cuando se este listo para pasar a producción se debe cambiar la URL a esta URL: `https://acme-v02.api.letsencrypt.org/directory`.
- `acme_version`: Versíon de ACME a utilizar. Por defecto viene configurado para la versión `1`.
- `chain_dest`: Si se especifica, el certificado intermedio se escribira en esta ubicación.
- `challenge`: El tipo de `challenge` que se va a ejecutar.
- `csr`: Archivo que contiene el `CSR` para el nuevo certificado. Se puede crear con el comando `openssl req...`. **OBS: Este certificado no se debería crear a partir de la llave utilizada para administrar la cuenta.**
- `data`: La información utilizada para validar el `challenge` en ejecución. Debe ser configurada en la segunda ejecución del módulo.
- `dest`: El destino del certificado.
- `force`: Fuerza la ejecución del challenge, aún cuando exista un certificad valido.
- `fullchain_dest`: El destino del archivo con el `full-chain` (el certificado seguido por la cadena de certificados intermedios).
- `modify_account`: Bandea que indica si el módulo debería crear una cuenta y actualizar los datos de contacto.
- `remaining_days`: La cantidad de días que el certificado tenga de validez. Si este valor es menor al indicado, el certificado se renovará. Si se configurar la variable `force` el certificado se renovará siempre.

**Importante**

- Al menos uno de los valores de `dest` y `fullchain_dest` debe ser específicado.
- Este módulo puede ser utilizado con cualquier CA que implemente el protocolo ACME.
- Para revocar certificdos se puede utilizar el módulo `acme_certificate_revoke`.
- Para una mejor administración de la cuenta de ACME se puede utilizar el módulo `acme_account`.
- Para debuguear un servidor de ACME se puede utilizar el módulo `acme_inspect`.

#### Ejemplo

```yaml
# Ejemplo con DNS challenge y Route53
---
- name: Creare el challenge para el dominio
  acme_certificate:
    account_key_src: '{{ acme_certificate_account_key_src }}'
    account_email: '{{ acme_certificate_account_email }}'
    csr: '{{ acme_certificate_csr }}'
    dest: '{{ acme_certificate_dest }}'
    challenge: dns-01
    acme_directory: '{{ acme_certificate_directory | default("https://acme-staging-v02.api.letsencrypt.org/directory") }}'
    # Se renueva el certificado si tiene por lo menos 60 días.
    remaining_days: '{{ acme_certificate_remaining_days | default(30) }}'
  register: acme_certificate_challenge
  
- name: Creación del registro para validar el challenge en Route 53
  route53:
    zone: '{{ route53_zone }}'
    record: '{{ item.key }}'
    type: TXT
    ttl: 60
    state: present
    wait: yes
    value: '{{ item.value | map("regex_replace", "^(.*)$', '\"\\1\"") | list}}'
  loop: '{{ acme_certificate_challenge.challenge_data_dns | dictsort }}'
  when: acme_certificate_challenge is changed

- name: Indicar al CA que el challenge puede ser validado
  acme_certificate:
    account_key_src: '{{ acme_certificate_account_key_src }}'
    account_email: '{{ acme_certificate_account_email }}'
    csr: '{{ acme_certificate_csr }}'
    dest: '{{ acme_certificate_dest }}'
    fullchain_dest: '{{ acme_certificate_fullchain_dest }}'
    chain_dest: '{{ acme_certificate_chain_dest }}'
    challenge: dns-01
    acme_directory: '{{ acme_certificate_directory }}'
    remaining_days: '{{ acme_certificate_remaining_days | default(30) }}'
    data: '{{ acme_certificate_challenge }}'
```

### Creación de llaves privadas

Para crear llaves privadas podemos usar el módulo `openssl_privatekey`. Genera llaves RSA, DSA, ECC, y EdDSA, en formato PEM.

Parámetros de inters:

- `backup`: Crea un archivo de backup para recuperar la llave privada original en caso de sobreescribirla. **Sumamente recomendada**.
- `cipher`: El `cipher` a utilizar para encriptar la llave. Por ejemplo: `aes256`. Se puede encontrar la lista de `cipher` validos utilizando el siguiente comando: `openssl list-cipher-algorithms`.
- `force`: Crea la llave aún cuando ya existe la misma.
- `mode`: Los permisos del archivo o directorio creado. Por ejemplo `'400'`.
- `passphrase`: Palabra clave de la llave.
- `path`: Nombre del archivo donde se almacenará la llave.
- `size`: El tamaño en bits de la llave a generar. Valor por defect: `4096`.
- `state`: Si la llave debe existir o no.
- `type`: El algoritmo a utilizar para crear la llave. Valor por defecto: `RSA`.
- `unsafe_writes`: Indica si el módulo puede usar operaciones inseguras para modificar los archivos. Útil por ejemplo con archivos montados como vólumenes de `docker`.

#### Ejemplo

```yaml
- name: Genera un nueva llave privada con valores por defecto
  openssl_privatekey:
    path: '{{ openssl_privatekey_path }}'
```

### Creación de OpenSSL CSR

Este módulo permite la creación y regeneración de CSR con OpenSSL.

Parámetros de interes:

- `backup`: Crea un backup del CSR actual, para recuperarlo en caso de sobrescribirlo sin intención.
- `common_name`: Configura el campo `commonName` del CSR.
- `country_name`: Configura el campo `countryName` del CSR.
- `email_address`: Configura el campo `emailAddress` del CSR.
- `force`: Crea el certificado aunque ya exista uno.
- `key_usage`: Define el proposito del certificado (encriptación, firma, firma de certificado).
- `organization_name`: Configura el campo `organizationName` del CSR.
- `organization_unit_name`: Configura el campo `organizationUnitName` del CSR.
- `path`: Dirección en donde se almacenará el certificado.
- `privatekey_path`: Ubicación de la llave privada con la que se firmara el CSR.
- `privatekey_passphrase`: Passphrase de la llave privada.
- `state`: Indica si el certificado debe existir o no.
- `subject`: Pares de llave/valor presentes en el campo `subject` del certificado. Si se necesita más de uno se pueden pasar como una lista.
- `unsafe_writes`: Indica si el módulo puede usar operaciones inseguras para modificar los archivos. Útil por ejemplo con archivos montados como vólumenes de `docker`.

#### Ejemplo

```yaml
- name: Generación de un nuevo CSR
  openssl_csr:
    path: '{{ openssl_csr_path }}'
    privatekey_path: '{{ openssl_cst_privatekey_path }}'
    country_name: '{{ openssl_csr_country_name }}'
    organization_name: '{{openssl_csr_organization_name}}'
    email_address: '{{ openssl_csr_email_address }}'
    common_name: '{{ openssl_csr_common_name }}'
    subject_alt_name: "{{ item.value | map('regex_replace', '^', 'DNS:') | list }}"
  with_dict:
    dns_server:
      - '{{ domain }}'
      - '*.{{ domain }}'
```

## SSL con NGINX

Para configurar HTTPS en NGINX es necesario configurar los parámetros `ssl` en el `server block`, incluyendo las ubicaciones del certificado del servidor y la llave privada.

```nginx
server {
  listen              443 ssl;
  server_name         www.example.com;
  ssl_certificate     www.example.com.crt;
  ssl_certificate_key www.example.com.key;
  ssl_protocols       TLSv1 TLSv1.1 TLSv1.2;
  ssl_ciphers         HIGH:!aNULL:!MD5;
  ...
}
```

El certificado es una entidad pública. Será enviado a todos los clientes que se conecten con el servidor. La llave privada es una entidad segura. Debe ser almacenada con acceso reestringido.

Las directivas `ssl_protocols` y `ssl_ciphers` configuran SSL/TLS. Nginx por defecto ya configura conexiones seguras, por lo que muchas veces es redundante configurar estos parámetros.

Realizar operaciones SSL consume recursos del CPU. En servidores con multiples procesadores lo ideal es correr múltiples `workers`. No menos que la cantidad de `cores` que tenga el sistema. Existen acciones que se pueden tomar para limitar la cantidad de operaciones a realizar por los clientes:

- Habilitar conexiones con `keepalive` para enviar múltiples `requests` en una misma conexión.
- Reutilizar parámetros de sesión SSL.

Se pueden configurar estos parámetros de esta manera:

```nginx
worker_processes auto;

http {
  ssl_session_cache     shared:SSL:10m;
  ssl_session_timeout   10m;

  server {
    listen              443 ssl;
    server_name         www.example.com;
    keepalive_timeout   70;
    ...
  }
  ...
}
```

Esto configurara múltiples workers de forma automatica, aumenta el tiempo de sesión a 10 minutos, y configura el cache para ocupar hasta 10 MB (4000 sesiones pueden almacenarce en 1 MB)

Algunos browsers pueden quejarse al momento de aceptar un certificado que fue firmado utilizando un certificado intermedio, que no se encuentre presente en la base de certificados `well-known` con las que cuenta el browser. En estos casos se debe prover una lista encadenada de certificados que incluya estos certificados intermedios para validar. 

```nginx
server {
  listen              443 ssl;
  server_name         www.example.com;
  ssl_certificate     www.example.com.chained.crt;
  ssl_certificate_key www.example.com.key;
}
```

Es posible configurar en el mismo servidor para servir HTTP y HTTPS

```nginx
server {
  listen              80;
  listen              443 ssl;
  server_name         www.example.com;
  ssl_certificate     www.example.com.crt;
  ssl_certificate_key www.example.com.key;
  ...
}
```

Si se necesita servir múltiples dominios con HTTPS lo recomendable es servir cada uno en una IP diferente.

```nginx
server {
  listen          192.168.1.1:443 ssl;
  server_name     www.example.com;
  ssl_certificate www.example.com.crt;
  ...
}

server {
  listen          192.168.1.2:443 ssl;
  server_name     www.example.org;
  ssl_certificate www.example.org.crt;
  ...
}
```

Otra forma es contar con un certificado que siva para múltiples nombres de dominio. Esto se hace configurando los nombres en el campo `SubjectAltName` pero su longitud es limitada.

Si los dominios que se sirven del servidor comparten una misma raiz del nombre de dominio se puede usar un certificado wildcard tipo `*.example.com`.

```nginx
ssl_certificate       common.crt;
ssl_certificate_key   common.key;

server {
  listen              443 ssl;
  server_name         www.example.com;
  ...
}

server {
  listen              443 ssl;
  server_name         www.example.org;
  ...
}
```

## NGINX Reverse Proxy

Se puede utilizar NGINX para:

- Distribuir la carga entre múltiples servicios.
- Mostrar contenido de diferente sitios.
- Pasar `requests` a servidores de aplicación sobre HTTP.

Cuando NGINX hace de proxy, envía el request al destino, obtiene la respuesta y la envía de nuevo al cliente. Se puede hacer de proxy contra otros servidores HTTP (NGINX o no), u otro tipo de servidor utilizando otro protocolo. Como FastCGI, uswgi, SCGI, memcached.

Para configurar esto es necesario configurar la directiva `proxy_pass` especificada dentro del block `location`.

```nginx
location /some/path/ {
  proxy_pass http://www.example.com/link/;
}

location ~ \.php {
  proxy_pass http://127.0.0.1:8000;
}
```

En la configuración anterior, cuando llega un `request` hacia `/some/path/page.html` se enviara el request a `http://www.example.com/link/page.html`.

Para configurar un servidor proxy no-HTTP es necesario configurar la directiva apropiada. Por ejemplo:

- `fastcgi_pass`
- `uwsgi_pass`
- `scgi_pass`
- `memcached_pass`

La reglas de cada una de estas directivas deben ser obtenidas de su sitio de documentación.

Al momento de pasar el `request` NGINX elimina los encabezados vacios del request original y agrega los encabezados `Host` y `Connection` con la variable `$proxy_host` y el valor `Close` respectivamente.

Para cambiar estos parámetros o configurar otros encabeazados se utiliza la directiva `proxy_set_header`. Se puede especificar en un block de `server`, `location`, o `http`.

```nginx
location /some/path/ {
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_pass http://localhost:8000;
}
```

De la misma forma, se puede evitar que se envíe un encabezado asignandolo a un string vacío.

## Configuración de NGINX como proxy para Keycloak

```nginx
user nginx;
worker_processes auto;

http {
  include         /etc/nginx/mime.types;
  default_type    text/html;

  server {
    listen 80;

    location /keycloak/ {
      proxy_pass          http://keycloak:8080/;
      proxy_set_header    Host               $host;
      proxy_set_header    X-Real-IP          $remote_addr;
      proxy_set_header    X-Forwarded-For    $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Host   $host;
      proxy_set_header    X-Forwarded-Server $host;
      proxy_set_header    X-Forwarded-Port   $server_port;
      proxy_set_header    X-Forwarded-Proto  $scheme;
    }

    location /keycloak/auth/ {
      proxy_pass          http://keycloak:8080/keycloak/auth/;
      proxy_set_header    Host               $host;
      proxy_set_header    X-Real-IP          $remote_addr;
      proxy_set_header    X-Forwarded-For    $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Host   $host;
      proxy_set_header    X-Forwarded-Server $host;
      proxy_set_header    X-Forwarded-Port   $server_port;
      proxy_set_header    X-Forwarded-Proto  $scheme;
    }
  }
}
```