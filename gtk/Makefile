CC ?= gcc
CFLAGS ?=
LDFLAGS ?=
PKG_CONFIG ?= pkg-config

GTK_CFLAGS := $(shell $(PKG_CONFIG) --cflags gtk4 json-c gio-2.0)
GTK_LIBS := $(shell $(PKG_CONFIG) --libs gtk4 json-c gio-2.0)

SRC := gtk_desktop.c
BIN := gtk_desktop

all: $(BIN)

$(BIN): $(SRC)
	$(CC) $(CFLAGS) $(GTK_CFLAGS) $< -o $@ $(LDFLAGS) $(GTK_LIBS)

clean:
	rm -f $(BIN)

.PHONY: all clean
