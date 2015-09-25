all: build run

run:
	-docker rm geojson.io
	docker run -i -t -p 8080:80 --name geojson.io geojson.io

build:
	docker build -t geojson.io .
