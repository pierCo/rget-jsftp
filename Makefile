test:
	./node_modules/.bin/mocha --reporter spec

clean:
	rm -rf reports

coverage:
	rm -rf reports
	mkdir reports
	@test -d reports
	./node_modules/.bin/istanbul cover --report lcovonly --dir ./reports ./node_modules/.bin/_mocha -- -R mocha-istanbul --colors ./test/rget-test.js

.PHONY: test coverage clean
