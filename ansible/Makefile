.PHONY: up down letsencrypt

up: ANSIBLE_CONFIG=./ansible.cfg
up: 
	ansible-playbook project.yml --extra-vars "docker_compose_state=present"

down: ANSIBLE_CONFIG=./ansible.cfg
down: 
	ansible-playbook project.yml --extra-vars "docker_compose_state=absent"

letsencrypt: ANSIBLE_CONFIG=./ansible.cfg
letsencrypt:
	ansible-playbook letsencrypt.yml