#!/bin/bash

uncomment_tls_block() {
    local file_path="$1"

    if [[ ! -f "$file_path" ]]; then
        echo "File not found: $file_path"
        exit 1
    fi

    awk '
    /\/\*tls:/ {
        print "  tls: {"
        in_block = 1
        next
    }
    in_block {
        if (/\*\//) {
            print "  },"
            in_block = 0
            next
        }
        print
    }
    !in_block {
        print
    }
    ' "$file_path" > temp_file && mv temp_file "$file_path"

    echo "TLS block uncommented successfully."
}

rm -rf staging
rm -rf build
mkdir staging

cp -r website/src staging/src
if [ "$1" = "public" ]; then
    cp -r website/public staging/public
fi
#cp website/database.json staging/database.json
cp -r .git staging/.git

for file in staging/src/pages/*; do # minify
    if [[ -f "$file" && "$file" == *.js ]]; then
        echo "Minifying $file"
        bun build --minify $file --outfile $file.temp
        mv "$file.temp" "$file"
        echo "Replaced $file with minified version."
    fi
done

if [ "$1" = "send" ]; then
    uncomment_tls_block "staging/src/index.ts"
fi
bun build --minify staging/src/index.ts --outfile staging/src/index.js --target bun --sourcemap
rm staging/src/index.ts

mv staging build
cp -r website/include build
mv build/include/* build
rmdir build/include

if [ "$1" = "send" ]; then
    zip -r build/git_archive build/.git
    rm -rf build/.git
    scp -r build thebadlorax@thebadlorax.dev:~/
fi