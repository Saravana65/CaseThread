@echo off
echo ==============================================================================
echo CASETHREAD Core Algorithm Engine - Windows MSVC Build Tool
echo ==============================================================================

if not exist bin mkdir bin

call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

echo Compiling casethread_engine.exe...
cl /nologo /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /Fe:bin\casethread_engine.exe /Iinclude src\*.c src\structures\*.c src\hashmap\*.c src\trees\*.c src\graphs\*.c src\algorithms\*.c src\spatial\*.c

echo Compiling test_dsa.exe...
cl /nologo /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /Fe:bin\test_dsa.exe /Iinclude tests\test_dsa.c src\structures\*.c src\hashmap\*.c src\trees\*.c src\graphs\*.c src\algorithms\*.c src\evidence.c src\spatial\*.c

echo Compiling test_quadtree.exe...
cl /nologo /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /Fe:bin\test_quadtree.exe /Iinclude tests\test_quadtree.c src\spatial\*.c

echo Compiling benchmark_quadtree.exe...
cl /nologo /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /Fe:bin\benchmark_quadtree.exe /Iinclude tests\benchmark_quadtree.c src\spatial\*.c

echo Compiling test_dsa_deep.exe...
cl /nologo /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /Fe:bin\test_dsa_deep.exe /Iinclude tests\test_dsa_deep.c src\structures\*.c src\hashmap\*.c src\trees\*.c src\graphs\*.c src\algorithms\*.c src\evidence.c src\spatial\*.c

echo Compiling benchmark_dsa.exe...
cl /nologo /O2 /W3 /D_CRT_SECURE_NO_WARNINGS /Fe:bin\benchmark_dsa.exe /Iinclude tests\benchmark_dsa.c src\structures\*.c src\hashmap\*.c src\trees\*.c src\graphs\*.c src\algorithms\*.c src\evidence.c src\spatial\*.c

if exist *.obj del *.obj

echo ==============================================================================
echo BUILD COMPLETED SUCCESSFULLY
echo Binary:     bin\casethread_engine.exe
echo Tests:      bin\test_dsa.exe
echo Benchmark:  bin\benchmark_dsa.exe
echo ==============================================================================
