@echo off
rem Push the given theme files from the repo to the three live demo themes, then sync the demo copies.
rem usage: push-files.cmd sections/footer.liquid sections/x.liquid ...
setlocal
set HERE=%~dp0
call "%HERE%push-one.cmd" skinova-hveyg6a1 167169687792 %*
call "%HERE%push-one.cmd" oblique-club-vrjg1qy6 155517223095 %*
call "%HERE%push-one.cmd" oblique-hush-jqtqsh01 186698170583 %*
python "%HERE%demo.py" sync
