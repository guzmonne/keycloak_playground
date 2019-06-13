.PHONY: template

template:
	cd ansible && make templates && cd ..

nginx: template
	docker-compose up -d --no-deps --force-recreate --build nginx