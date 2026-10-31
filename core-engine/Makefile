# ==============================================================================
# CASETHREAD CORE DSA ENGINE MAKEFILE
# Compatible with GCC / Clang / MinGW / Linux Docker
# ==============================================================================

CC ?= gcc
CFLAGS ?= -Wall -Wextra -pedantic -std=c99 -Iinclude -O2
DEBUG_FLAGS ?= -g -DDEBUG -O0
LDFLAGS ?= -lm

BIN_DIR := bin
BUILD_DIR := build
SRC_DIR := src
INCLUDE_DIR := include
TEST_DIR := tests

TARGET := $(BIN_DIR)/casethread_engine
TEST_TARGET := $(BIN_DIR)/test_dsa

ifeq ($(OS),Windows_NT)
    TARGET := $(BIN_DIR)/casethread_engine.exe
    TEST_TARGET := $(BIN_DIR)/test_dsa.exe
endif

# Source discovery
ENGINE_SRCS := $(wildcard $(SRC_DIR)/*.c) \
               $(wildcard $(SRC_DIR)/structures/*.c) \
               $(wildcard $(SRC_DIR)/hashmap/*.c) \
               $(wildcard $(SRC_DIR)/trees/*.c) \
               $(wildcard $(SRC_DIR)/graphs/*.c) \
               $(wildcard $(SRC_DIR)/algorithms/*.c)

TEST_SRCS := $(TEST_DIR)/test_dsa.c \
             $(wildcard $(SRC_DIR)/structures/*.c) \
             $(wildcard $(SRC_DIR)/hashmap/*.c) \
             $(wildcard $(SRC_DIR)/trees/*.c) \
             $(wildcard $(SRC_DIR)/graphs/*.c) \
             $(wildcard $(SRC_DIR)/algorithms/*.c) \
             $(SRC_DIR)/evidence.c

# Default target
.PHONY: all
all: directories $(TARGET)

directories:
	@mkdir -p $(BIN_DIR)
	@mkdir -p $(BUILD_DIR)

$(TARGET): $(ENGINE_SRCS)
	$(CC) $(CFLAGS) $(ENGINE_SRCS) -o $(TARGET) $(LDFLAGS)
	@echo "[SUCCESS] Built CaseThread Core Engine: $(TARGET)"

$(TEST_TARGET): $(TEST_SRCS)
	$(CC) $(CFLAGS) $(TEST_SRCS) -o $(TEST_TARGET) $(LDFLAGS)
	@echo "[SUCCESS] Built CaseThread Unit Test Suite: $(TEST_TARGET)"

debug: CFLAGS += $(DEBUG_FLAGS)
debug: clean all

.PHONY: clean
clean:
	rm -rf $(BUILD_DIR) $(BIN_DIR)/*.o $(TARGET) $(TEST_TARGET) *.obj
	@echo "[CLEAN] Removed build artifacts and binaries."

.PHONY: test
test: directories $(TEST_TARGET)
	@echo "[TEST] Running Core Engine DSA Verification Suite..."
	@$(TEST_TARGET)
