.PHONY: template nginx up down

template:
	cd ansible && make templates && cd ..

nginx: template
	docker-compose up -d --no-deps --force-recreate --build nginx

up:
	cd ansible && make up && cd ..

down:
	cd ansible && make down && cd ..

certificates:
	cd ansible && make letsencrypt && cd ..