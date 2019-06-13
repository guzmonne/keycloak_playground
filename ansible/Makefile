.PHONY: up down letsencrypt templates

up: ANSIBLE_CONFIG=./ansible.cfg
up: 
	ansible-playbook project.yml --extra-vars "docker_compose_state=present"

down: ANSIBLE_CONFIG=./ansible.cfg
down: 
	ansible-playbook project.yml --extra-vars "docker_compose_state=absent"

templates: ANSIBLE_CONFIG=./ansible.cfg
templates:
	ansible-playbook project.yml --tags "template"

letsencrypt: ANSIBLE_CONFIG=./ansible.cfg
letsencrypt:
	ansible-playbook letsencrypt.yml 