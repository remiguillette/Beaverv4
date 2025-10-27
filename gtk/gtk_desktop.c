#include <gtk/gtk.h>
#include <gio/gio.h>
#include <json-c/json.h>
#include <stdio.h>
#include <string.h>

static GSocketConnection *connection = NULL;
static GOutputStream *out_stream = NULL;
static GInputStream *in_stream = NULL;
static guint status_timeout_id = 0;

static void on_window_destroy(GtkWidget *widget, gpointer user_data);

static void
close_connection(void)
{
    if (connection != NULL) {
        g_io_stream_close(G_IO_STREAM(connection), NULL, NULL);
        g_clear_object(&connection);
    }

    if (out_stream != NULL) {
        g_clear_object(&out_stream);
    }

    if (in_stream != NULL) {
        g_clear_object(&in_stream);
    }
}

static void
send_ipc_message(const char *message)
{
    if (out_stream == NULL) {
        return;
    }

    g_output_stream_write(out_stream, message, strlen(message), NULL, NULL);
    g_output_stream_flush(out_stream, NULL, NULL);
}

static gboolean
read_ipc_response(GtkLabel *label)
{
    if (in_stream == NULL) {
        gtk_label_set_text(label, "No IPC stream available");
        return G_SOURCE_REMOVE;
    }

    char buffer[1024];
    gssize n_read = g_input_stream_read(in_stream, buffer, sizeof(buffer) - 1, NULL, NULL);

    if (n_read <= 0) {
        gtk_label_set_text(label, "IPC connection closed");
        return G_SOURCE_REMOVE;
    }

    buffer[n_read] = '\0';

    struct json_object *json = json_tokener_parse(buffer);
    if (json == NULL) {
        gtk_label_set_text(label, "Invalid response from backend");
        return G_SOURCE_REMOVE;
    }

    struct json_object *battery_obj = NULL;
    struct json_object *wifi_obj = NULL;

    json_object_object_get_ex(json, "battery", &battery_obj);
    json_object_object_get_ex(json, "wifi", &wifi_obj);

    const char *battery = battery_obj ? json_object_get_string(battery_obj) : "?";
    const char *wifi = wifi_obj ? json_object_get_string(wifi_obj) : "?";

    char formatted[256];
    snprintf(formatted, sizeof(formatted), "\xF0\x9F\x94\x8B %s   |   \xF0\x9F\x93\xB6 %s", battery, wifi);
    gtk_label_set_text(label, formatted);

    json_object_put(json);
    return G_SOURCE_REMOVE;
}

static void
refresh_status(GtkLabel *label)
{
    send_ipc_message("{\"type\":\"get-status\"}\n");
    g_idle_add((GSourceFunc)read_ipc_response, label);
}

static gboolean
refresh_status_periodic(gpointer user_data)
{
    GtkLabel *label = GTK_LABEL(user_data);

    if (!gtk_widget_get_root(GTK_WIDGET(label))) {
        status_timeout_id = 0;
        return G_SOURCE_REMOVE;
    }

    refresh_status(label);
    return G_SOURCE_CONTINUE;
}

static void
on_launch_button_clicked(GtkButton *button, gpointer user_data)
{
    const char *app_id = (const char *)user_data;
    if (app_id == NULL) {
        return;
    }

    char payload[256];
    snprintf(payload, sizeof(payload), "{\"type\":\"launch-app\",\"appId\":\"%s\",\"origin\":\"gtk-frontend\"}\n", app_id);
    send_ipc_message(payload);
    g_message("Requested launch for app id: %s", app_id);
}

static void
activate(GtkApplication *app, gpointer user_data)
{
    GtkWidget *window = gtk_application_window_new(app);
    gtk_window_set_title(GTK_WINDOW(window), "Hybrid Desktop");
    gtk_window_set_default_size(GTK_WINDOW(window), 520, 280);

    GtkWidget *outer_box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 12);
    gtk_widget_set_margin_top(outer_box, 20);
    gtk_widget_set_margin_bottom(outer_box, 20);
    gtk_widget_set_margin_start(outer_box, 20);
    gtk_widget_set_margin_end(outer_box, 20);
    gtk_window_set_child(GTK_WINDOW(window), outer_box);

    GtkWidget *status_label = gtk_label_new("Connecting to backend...");
    gtk_label_set_xalign(GTK_LABEL(status_label), 0.0f);
    gtk_box_append(GTK_BOX(outer_box), status_label);

    GtkWidget *button_box = gtk_flow_box_new();
    gtk_flow_box_set_selection_mode(GTK_FLOW_BOX(button_box), GTK_SELECTION_NONE);
    gtk_flow_box_set_column_spacing(GTK_FLOW_BOX(button_box), 12);
    gtk_flow_box_set_row_spacing(GTK_FLOW_BOX(button_box), 12);
    gtk_box_append(GTK_BOX(outer_box), button_box);

    GSocketClient *client = g_socket_client_new();
    GError *error = NULL;

    connection = g_socket_client_connect_to_uri(client, "unix:/tmp/desktop-menu.sock", 0, NULL, &error);

    if (connection == NULL) {
        gchar *message = g_strdup_printf("Unable to reach backend: %s", error->message);
        gtk_label_set_text(GTK_LABEL(status_label), message);
        g_free(message);
        g_error_free(error);
        g_object_unref(client);
        return;
    }

    out_stream = g_io_stream_get_output_stream(G_IO_STREAM(connection));
    in_stream = g_io_stream_get_input_stream(G_IO_STREAM(connection));
    g_object_unref(client);

    send_ipc_message("{\"type\":\"hello\",\"client\":\"gtk-frontend\"}\n");
    refresh_status(GTK_LABEL(status_label));
    if (status_timeout_id != 0) {
        g_source_remove(status_timeout_id);
    }
    status_timeout_id = g_timeout_add_seconds(30, refresh_status_periodic, status_label);

    struct {
        const char *id;
        const char *label;
        const char *emoji;
    } quick_actions[] = {
        {"browser", "Skyline Browser", "\xF0\x9F\x8C\x90"},
        {"files", "Archive Explorer", "\xF0\x9F\x97\x82\xEF\xB8\x8F"},
        {"music", "Waveform Studio", "\xF0\x9F\x8E\xA7"},
        {"mail", "Mail Station", "\xE2\x9C\x89\xEF\xB8\x8F"}
    };

    for (gsize i = 0; i < G_N_ELEMENTS(quick_actions); i++) {
        GtkWidget *card = gtk_button_new();
        gtk_widget_add_css_class(card, "card");

        GtkWidget *card_box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 4);
        GtkWidget *emoji = gtk_label_new(quick_actions[i].emoji);
        GtkWidget *label = gtk_label_new(quick_actions[i].label);

        gtk_widget_add_css_class(emoji, "card-emoji");
        gtk_widget_add_css_class(label, "card-title");

        gtk_box_append(GTK_BOX(card_box), emoji);
        gtk_box_append(GTK_BOX(card_box), label);
        gtk_button_set_child(GTK_BUTTON(card), card_box);

        g_signal_connect(card, "clicked", G_CALLBACK(on_launch_button_clicked), (gpointer)quick_actions[i].id);
        gtk_flow_box_append(GTK_FLOW_BOX(button_box), card);
    }

    const char *css =
        "window { background: #0b0b12; color: #f5f7ff; }"
        "label { font-size: 16px; }"
        "button.card {"
        "  padding: 16px;"
        "  border-radius: 12px;"
        "  background: rgba(255,255,255,0.08);"
        "  border: 1px solid rgba(255,255,255,0.15);"
        "  min-width: 160px;"
        "}"
        "button.card:hover {"
        "  background: rgba(66,119,255,0.25);"
        "}"
        "label.card-emoji { font-size: 32px; }"
        "label.card-title { font-size: 16px; font-weight: 600; }";

    GtkCssProvider *provider = gtk_css_provider_new();
    gtk_css_provider_load_from_data(provider, css, -1);
    gtk_style_context_add_provider_for_display(
        gtk_widget_get_display(window),
        GTK_STYLE_PROVIDER(provider),
        GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
    g_object_unref(provider);

    g_signal_connect(window, "destroy", G_CALLBACK(on_window_destroy), NULL);

    gtk_widget_show(window);
}

static void
on_window_destroy(GtkWidget *widget, gpointer user_data)
{
    (void)widget;
    (void)user_data;

    if (status_timeout_id != 0) {
        g_source_remove(status_timeout_id);
        status_timeout_id = 0;
    }

    close_connection();
}

int
main(int argc, char *argv[])
{
    GtkApplication *app = gtk_application_new("com.example.hybrid", G_APPLICATION_FLAGS_NONE);
    g_signal_connect(app, "activate", G_CALLBACK(activate), NULL);

    int status = g_application_run(G_APPLICATION(app), argc, argv);
    g_object_unref(app);
    return status;
}
