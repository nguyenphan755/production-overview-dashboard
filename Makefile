dev:
	cd frontend && npm run dev

backend:
	cd backend && npm start

install:
	cd frontend && npm install --legacy-peer-deps
	cd backend && npm install

test:
	cd frontend && npm run test
