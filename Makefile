test:
	./node_modules/.bin/mocha --reporter spec

coverage:
	@test -d reports || mkdir reports
	./node_modules/.bin/istanbul cover --report lcovonly --dir ./reports ./node_modules/.bin/_mocha -- -R mocha-istanbul --colors

clean:
	rm -rf reports

.PHONY: test coverage clean
