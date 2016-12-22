#
# gtkui.py
#
# Copyright (C) 2009 Chase Sterling <chase.sterling@gmail.com>
#
# Basic plugin template created by:
# Copyright (C) 2008 Martijn Voncken <mvoncken@gmail.com>
# Copyright (C) 2007-2009 Andrew Resch <andrewresch@gmail.com>
# Copyright (C) 2009 Damien Churchill <damoxc@gmail.com>
#
# Deluge is free software.
#
# You may redistribute it and/or modify it under the terms of the
# GNU General Public License, as published by the Free Software
# Foundation; either version 3 of the License, or (at your option)
# any later version.
#
# deluge is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with deluge.    If not, write to:
# 	The Free Software Foundation, Inc.,
# 	51 Franklin Street, Fifth Floor
# 	Boston, MA  02110-1301, USA.
#
#    In addition, as a special exception, the copyright holders give
#    permission to link the code of portions of this program with the OpenSSL
#    library.
#    You must obey the GNU General Public License in all respects for all of
#    the code used other than OpenSSL. If you modify file(s) with this
#    exception, you may extend this exception to your version of the file(s),
#    but you are not obligated to do so. If you do not wish to do so, delete
#    this exception statement from your version. If you delete this exception
#    statement from all source files in the program, then also delete it here.
#

# TODO: fix, Seed Min Ratio coloumn is not displaying properly
# TODO: fix, checkboxes in grid are not editable

import gtk
from gtk._gtk import Tooltips

from deluge.log import LOG as log
from deluge.ui.client import client
from deluge.plugins.pluginbase import GtkPluginBase
import deluge.component as component
from deluge.ui.gtkui.listview import cell_data_time, cell_data_ratio

from common import get_resource


def cell_data_ratio_seed_min(column, cell, model, row, data):
    cell_data_ratio(cell, model, row, data, 'cell_data_ratio_seed_min')


class GtkUI(GtkPluginBase):
    def enable(self):
        self.glade = gtk.glade.XML(get_resource("config.glade"))

        component.get("Preferences").add_page("SeedTime", self.glade.get_widget("prefs_box"))
        component.get("PluginManager").register_hook("on_apply_prefs", self.on_apply_prefs)
        component.get("PluginManager").register_hook("on_show_prefs", self.on_show_prefs)
        # Columns
        torrentview = component.get("TorrentView")
        torrentview.add_func_column(_("Seed Time"), cell_data_time, [int], status_field=["seeding_time"])
        torrentview.add_func_column(_("Stop Seed Time"), cell_data_time, [int], status_field=["seed_stop_time"])
        torrentview.add_func_column(_("Remaining Seed Time"), cell_data_time, [int], status_field=["seed_time_remaining"])
        # torrentview.add_func_column(_("Seed Min Ratio"), cell_data_ratio_seed_min, [float], status_field=["seed_min_ratio"])
        # Submenu
        log.debug("add items to torrentview-popup menu.")
        torrentmenu = component.get("MenuBar").torrentmenu
        self.seedtime_menu = SeedTimeMenu()
        torrentmenu.append(self.seedtime_menu)
        self.seedtime_menu.show_all()

        # Build Preference filter table
        self.setupFilterTable()

    def setupFilterTable(self):
        # Setup filter button callbacks
        self.btnAdd = self.glade.get_widget("btnAdd")
        self.btnAdd.connect("clicked", self.btnAddCallback)
        self.btnRemove = self.glade.get_widget("btnRemove")
        self.btnRemove.connect("clicked", self.btnRemoveCallback)
        self.btnUp = self.glade.get_widget("btnUp")
        self.btnUp.connect("clicked", self.btnUpCallback)
        self.btnDown = self.glade.get_widget("btnDown")
        self.btnDown.connect("clicked", self.btnDownCallback)

        # cell by cell renderer callback, changes field and filter to editable
        def rowRendererCb(column, cell, model, itr):
            cell.set_property('editable', True)

        # creating the treeview,and add columns
        self.treeview = gtk.TreeView()

        # setup Field column
        liststore_field = gtk.ListStore(str)
        for item in ["tracker", "label"]:
            liststore_field.append([item])
        renderer = gtk.CellRendererCombo()
        renderer.set_property("editable", True)
        renderer.set_property("model", liststore_field)
        renderer.set_property("text-column", 0)
        renderer.set_property("has-entry", False)
        renderer.connect("edited", self.on_field_changed)
        column = gtk.TreeViewColumn("Field", renderer, text=0)
        column.set_property("resizable", True)
        column.set_cell_data_func(renderer, rowRendererCb)
        label = gtk.Label("Field")
        label.set_property("justify", gtk.JUSTIFY_CENTER)
        column.set_widget(label)
        label.show()
        tooltips = Tooltips()
        tooltips.set_tip(label, "Torrent Field to filter.")
        self.treeview.append_column(column)

        # setup Filter column
        renderer = gtk.CellRendererText()
        renderer.set_property("editable", True)
        renderer.connect("edited", self.on_filter_changed)
        column = gtk.TreeViewColumn("Filter", renderer, text=1)
        column.set_property("resizable", True)
        column.set_cell_data_func(renderer, rowRendererCb)
        label = gtk.Label("Filter")
        label.set_property("justify", gtk.JUSTIFY_CENTER)
        column.set_widget(label)
        label.show()
        tooltips = Tooltips()
        tooltips.set_tip(label, "RegEx filter to apply to Field")
        self.treeview.append_column(column)

        # setup stop time column
        renderer = gtk.CellRendererSpin()
        renderer.connect("edited", self.on_stoptime_edited)
        renderer.set_property("editable", True)
        adjustment = gtk.Adjustment(0, 0, 100, 0.01, 10, 0)
        renderer.set_property("adjustment", adjustment)
        column = gtk.TreeViewColumn("Stop Seed\nTime (days)", renderer, text=2)
        column.set_property("resizable", True)
        label = gtk.Label("Stop Seed\nTime (days)")
        label.set_property("justify", gtk.JUSTIFY_CENTER)
        column.set_widget(label)
        label.show()
        tooltips = Tooltips()
        tooltips.set_tip(label, "Set the amount of time a torrent seeds for "
                                "before being stopped. Default value is editable")
        self.treeview.append_column(column)
        
        # setup min ratio column
        renderer = gtk.CellRendererSpin()
        renderer.connect("edited", self.on_min_ratio_edited)
        renderer.set_property("editable", True)
        adjustment = gtk.Adjustment(0, 0, 100, 0.01, 1, 0)
        renderer.set_property("adjustment", adjustment)
        column = gtk.TreeViewColumn("Stop\nMin Ratio", renderer, text=3)
        column.set_property("resizable", True)
        label = gtk.Label("Stop\nMin Ratio")
        label.set_property("justify", gtk.JUSTIFY_CENTER)
        column.set_widget(label)
        label.show()
        tooltips = Tooltips()
        tooltips.set_tip(label, "Set the minimum ratio, after which a seeding "
                                "torrent will stop. Default value is editable")
        self.treeview.append_column(column)

        # setup remove torrent column
        renderer = gtk.CellRendererToggle()
        renderer.connect("toggled", self.on_remove_torrent_edited)
        renderer.set_property("activatable", True)
        column = gtk.TreeViewColumn("Remove\nTorrent", renderer, active=4)
        column.set_property("resizable", True)
        # column.set_cell_data_func(renderer, rowRendererCb)
        label = gtk.Label("Remove\nTorrent")
        label.set_property("justify", gtk.JUSTIFY_CENTER)
        column.set_widget(label)
        label.show()
        tooltips = Tooltips()
        tooltips.set_tip(label, "Set if a torrent is removed when stop seedtime "
                                "conditions are met")
        self.treeview.append_column(column)

        # setup remove data column
        renderer = gtk.CellRendererToggle()
        renderer.connect("toggled", self.on_remove_data_edited)
        renderer.set_property("activatable", True)
        column = gtk.TreeViewColumn("Remove\nData", renderer, active=5)
        column.set_property("resizable", True)
        label = gtk.Label("Remove\nData")
        label.set_property("justify", gtk.JUSTIFY_CENTER)
        column.set_widget(label)
        label.show()
        tooltips = Tooltips()
        tooltips.set_tip(label, "Set if a torrent's data is removed when stop "
                                "seedtime conditions are met, remove torrent "
                                "must also be set")
        self.treeview.append_column(column)

        self.sw1 = self.glade.get_widget('scrolledwindow1')
        self.sw1.add(self.treeview)
        self.sw1.show_all()

    def disable(self):
        component.get("Preferences").remove_page("SeedTime")
        component.get("PluginManager").deregister_hook("on_apply_prefs", self.on_apply_prefs)
        component.get("PluginManager").deregister_hook("on_show_prefs", self.on_show_prefs)
        try:
            # Columns
            component.get("TorrentView").remove_column(_("Seed Time"))
            component.get("TorrentView").remove_column(_("Stop Seed Time"))
            component.get("TorrentView").remove_column(_("Remaining Seed Time"))
            # component.get("TorrentView").remove_column(_("Seed Min Ratio"))
            # Submenu
            torrentmenu = component.get("MenuBar").torrentmenu
            torrentmenu.remove(self.seedtime_menu)
        except Exception, e:
            log.debug(e)

    def on_apply_prefs(self):
        log.debug("applying prefs for SeedTime")

        config = {
            "default_stop_time": self.glade.get_widget("default_stop_time").get_value(),
            "default_minimum_stop_ratio": self.glade.get_widget("default_min_ratio").get_value(),
            "delay_time": self.glade.get_widget("delay_time").get_value_as_int(),
            "filter_list": list({'field': row[0], 'filter': row[1], 'stop_time': row[2], 'stop_ratio': row[3], 'remove_torrent': row[4], 'remove_data': row[5]} for row in self.liststore),
        }
        client.seedtime.set_config(config)

    def on_show_prefs(self):
        client.seedtime.get_config().addCallback(self.cb_get_config)

    def cb_get_config(self, config):
        """callback for on show_prefs"""
        log.debug('cb get config seedtime')
        self.glade.get_widget("delay_time").set_value(config["delay_time"])
        self.glade.get_widget("default_stop_time").set_value(config["default_stop_time"])
        self.glade.get_widget("default_min_ratio").set_value(config["default_minimum_stop_ratio"])

        # populate filter table
        self.liststore = gtk.ListStore(str, str, float, float, bool, bool)
        for filter_ref in config['filter_list']:
            self.liststore.append([filter_ref['field'], filter_ref['filter'],
                                   filter_ref['stop_time'], filter_ref['stop_ratio'],
                                   filter_ref['remove_torrent'],
                                   filter_ref['remove_data']])

        self.treeview.set_model(self.liststore)

    def on_field_changed(self, widget, path, text):
        self.liststore[path][0] = text

    def on_filter_changed(self, widget, path, text):
        self.liststore[path][1] = text

    def on_stoptime_edited(self, widget, path, value):
        self.liststore[path][2] = float(value)

    def on_min_ratio_edited(self, widget, path, value):
        self.liststore[path][3] = float(value)

    def on_remove_torrent_edited(self, widget, path, value):
        self.liststore[path][4] = bool(value)

    def on_remove_data_edited(self, widget, path, value):
        self.liststore[path][5] = bool(value)

    def btnAddCallback(self, widget):
        self.liststore.prepend(["label", "RegEx", 3.0, 1.0, False, False])

    def btnRemoveCallback(self, widget):
        selection = self.treeview.get_selection()
        model, paths = selection.get_selected_rows()

        # Get the TreeIter instance for each path
        for path in paths:
            itr = model.get_iter(path)
            model.remove(itr)

    def btnUpCallback(self, widget):
        selection = self.treeview.get_selection()
        model, paths = selection.get_selected_rows()

        for path in paths:
            itr = model.get_iter(path)
            if path[0] > 0:
                previousRow = model.get_iter(path[0]-1)
                model.move_before(itr, previousRow)

    def btnDownCallback(self, widget):
        selection = self.treeview.get_selection()
        model, paths = selection.get_selected_rows()

        for path in paths:
            itr = model.get_iter(path)
            if path[0] < len(model)-1:
                nextRow = model.get_iter(path[0]+1)
                model.move_after(itr, nextRow)

class SeedTimeMenu(gtk.MenuItem):
    def __init__(self):
        gtk.MenuItem.__init__(self, "Seed Stop Time")

        self.sub_menu = gtk.Menu()
        self.set_submenu(self.sub_menu)
        self.items = []

        #attach..
        torrentmenu = component.get("MenuBar").torrentmenu
        self.sub_menu.connect("show", self.on_show, None)

    def get_torrent_ids(self):
        return component.get("TorrentView").get_selected_torrents()

    def on_show(self, widget=None, data=None):
        try:
            for child in self.sub_menu.get_children():
                self.sub_menu.remove(child)
            for time in (0, 1, 2, 3, 7, 14, 30):
                if time is 0:
                    item = gtk.MenuItem('Never')
                else:
                    item = gtk.MenuItem(str(time) + ' days')
                item.connect("activate", self.on_select_criteria, time)
                self.sub_menu.append(item)
            item = gtk.MenuItem('Custom')
            item.connect('activate', self.on_custom_criteria)
            self.sub_menu.append(item)
            self.show_all()
        except Exception, e:
            log.exception('AHH!')

    def on_select_criteria(self, widget=None, time=0, ratio=0, remove_torrent=False, remove_data=False):
        log.debug("select seed stop time:%s, ratio:%s, remove torrent:%s, remove data:%s, %s" %
                  (time, ratio, remove_torrent, remove_data, self.get_torrent_ids()) )
        for torrent_id in self.get_torrent_ids():
            client.seedtime.set_torrent(torrent_id, time, ratio, remove_torrent, remove_data)

    def on_custom_criteria(self, widget=None):
        # Show the custom time dialog
        glade = gtk.glade.XML(get_resource("config.glade"))
        dlg = glade.get_widget('dlg_custom_time')
        result = dlg.run()
        if result == gtk.RESPONSE_OK:
            kwargs = {}
            kwargs['time'] = glade.get_widget('custom_stop_time').get_value()
            kwargs['ratio'] = glade.get_widget('custom_stop_ratio').get_value()
            kwargs['remove_torrent'] = glade.get_widget('custom_remove_torrent').get_active()
            kwargs['remove_data'] = glade.get_widget('custom_remove_data').get_active()
            try:
                self.on_select_criteria(**kwargs)
            except ValueError:
                log.error('Invalid custom stop time entered.')
        dlg.destroy()
