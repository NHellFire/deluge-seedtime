/*
Script: seedtime.js
    The client-side javascript code for the SeedTime plugin.

Copyright:
    (C) Chase Sterling 2009 <chase.sterling@gmail.com>
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 3, or (at your option)
    any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, write to:
        The Free Software Foundation, Inc.,
        51 Franklin Street, Fifth Floor
        Boston, MA  02110-1301, USA.

    In addition, as a special exception, the copyright holders give
    permission to link the code of portions of this program with the OpenSSL
    library.
    You must obey the GNU General Public License in all respects for all of
    the code used other than OpenSSL. If you modify file(s) with this
    exception, you may extend this exception to your version of the file(s),
    but you are not obligated to do so. If you do not wish to do so, delete
    this exception statement from your version. If you delete this exception
    statement from all source files in the program, then also delete it here.
*/
// TODO: layout for customTimeWindow


// TODO: add same tooltips as gtk
// TODO: fix perferance page layout, filter list grid automatic height
// TODO: fix perferance page layout, resize buttons
// TODO: clean up: fix code formatting

Ext.ns('Deluge.ux');
Ext.ns('Deluge.ux.preferences');
Ext.ns('Ext.ux.grid');

Deluge.ux.preferences.SeedTimePage = Ext.extend(Ext.Panel, {
    border: false,
    title: _('SeedTime'),
    header: false,
    layout: {
        type: 'vbox',
        align: 'stretch'
    },
    hasReadConfig : false,

    initComponent: function() {
        Deluge.ux.preferences.SeedTimePage.superclass.initComponent.call(this);

        this.form = this.add({
            xtype: 'form',
            layout: 'form',
            border: false,
        });

        this.settings = this.form.add({
          xtype : 'fieldset',
          border : false,
          title : _('Settings'),
          defaultType : 'spinnerfield',
          defaults : {minValue : -1, maxValue : 99999},
          style : 'margin-top: 5px; margin-bottom: 0px; padding-bottom: 0px;',
          labelWidth : 200,
          items : [
            {
              fieldLabel : _('Default stop time (days)'),
              name : 'default_stop_time',
              width : 80,
              value : 30,
              minValue : 0,
              maxValue : 999,
              decimalPrecision : 2,
              id : 'default_stop_time'
            },
            {
              fieldLabel : _('Default minimum ratio'),
              name : 'default_min_ratio',
              width : 80,
              value : 30,
              minValue : 0,
              maxValue : 999,
              decimalPrecision : 2,
              id : 'default_min_ratio'
            },
            {
              fieldLabel : _('Delay (seconds)'),
              name : 'delay_time',
              width : 80,
              value : 30,
              minValue : 1,
              maxValue : 300,
              decimalPrecision : 0,
              id : 'torrent_delay'
            }
          ]
        });

        // create reusable renderer
        Ext.util.Format.comboRenderer = function(combo){
            return function(value){
                var record = combo.findRecord(combo.valueField, value);
                return record ? record.get(combo.displayField) : combo.valueNotFoundText;
            }
        };

        // create the combo instance
        var combo = new Ext.form.ComboBox({
            editable:false,
            triggerAction: 'all',
            lazyRender:true,
            mode: 'local',
            store: new Ext.data.ArrayStore({
                id: 0,
                fields: ['myId', 'displayText'],
                data: [[1, 'label'], [2, 'tracker']]
            }),
            valueField: 'displayText',
            displayField: 'displayText'
        });

        this.filter_list = new Ext.grid.EditorGridPanel({
          height: 300,  //TODO: instead of hard coding, expand height automatically
          flex: 1,
          store : new Ext.data.JsonStore({
            fields : [
              {name : 'field', type : 'string'},
              {name : 'filter', type : 'string'},
              {name : 'stop_time', type : 'float'},
              {name : 'stop_ratio', type : 'float'},
              {name : 'remove_torrent', type : 'boolean'},
              {name : 'remove_data', type : 'boolean'},
            ],
            id : 0
          }),
          colModel : new Ext.grid.ColumnModel({
            defaults : {sortable : false, menuDisabled : true},
            columns : [
              { header : '<small>Field</small>',
                width : .15,
                sortable : false,
                dataIndex : 'field',
                editor : combo,
                renderer : Ext.util.Format.comboRenderer(combo),
              },
              { header : '<small>Filter</small>',
                width : .21,
                dataIndex : 'filter',
                editor : {xtype : 'textfield' },
              },
              { header : '<small>Stop Seed<br>Time (days)</small>',
                width : .17,
                editor : { xtype : 'numberfield',
                           maxValue : 365.0,
                           minValue : 0.00 },
                dataIndex : 'stop_time'
              },
              { header : '<small>Stop<br>Min Ratio</small>',
                width : .17,
                editor : { xtype : 'numberfield',
                           maxValue : 999.0,
                           minValue : 0.00 },
                dataIndex : 'stop_ratio'
              },
              { header : '<small>Remove<br>Torrent</small>',
                width : .15,
                xtype : 'checkcolumn',
                dataIndex : 'remove_torrent'
              },
              { header : '<small>Remove<br>Data</small>',
                width : .15,
                xtype : 'checkcolumn',
                dataIndex : 'remove_data'
              },
            ]
          }),
          viewConfig : {forceFit : true},
          selModel : new Ext.grid.RowSelectionModel({singleSelect : true, moveEditorOnEnter : false}),
          plugins : [],
        });

        this.filter_list.addButton({text:"Up", iconCls: 'icon-up'}, this.filterUp, this);
        this.filter_list.addButton({text:"Down", iconCls: 'icon-down'}, this.filterDown, this);
        this.filter_list.addButton({text:"Add", iconCls: 'icon-add'}, this.filterAdd, this);
        this.filter_list.addButton({text:"Remove", iconCls: 'icon-remove'}, this.filterRemove, this);
        this.form.add(this.filter_list);

        this.defaultStoptime = this.settings.items.get("default_stop_time");
        this.defaultMinRatio = this.settings.items.get("default_min_ratio");
        this.delayTime = this.settings.items.get("torrent_delay");
        this.on('show', this.updateConfig, this);
    },

    filterUp: function() {
        var store = this.filter_list.getStore();
        var sm = this.filter_list.getSelectionModel();
        var selected_rec = sm.getSelected();
        var selected_indx = store.indexOf(selected_rec);

        if (selected_indx > 0 ) {
          store.remove(selected_rec);
          store.insert(selected_indx-1, selected_rec);
          sm.selectRow(selected_indx-1);
        }
    },

    filterDown: function() {
        var store = this.filter_list.getStore();
        var sm = this.filter_list.getSelectionModel();
        var selected_rec = sm.getSelected();
        var selected_indx = store.indexOf(selected_rec);

        if (selected_indx < store.getCount()-1 ) {
          store.remove(selected_rec);
          store.insert(selected_indx+1, selected_rec);
          sm.selectRow(selected_indx+1);
        }
    },

    filterAdd: function() {
        var store = this.filter_list.getStore();
        store.insert(0, new store.recordType({ field : "label",
                                               filter : "RegEx",
                                               stop_time : 7.0,
                                               stop_ratio : 1.0,
                                               remove_torrent : false,
                                               remove_data : false}));
    },

    filterRemove: function() {
        var store = this.filter_list.getStore();
        var selected_rec = this.filter_list.getSelectionModel().getSelected();
        store.remove(selected_rec);
    },

    onRender: function(ct, position) {
        Deluge.ux.preferences.SeedTimePage.superclass.onRender.call(this, ct, position);
    },

    onApply: function() {
        if(this.hasReadConfig) {
            //TODO: got to be a better way to get json out of the store, JsonWriter?
            var filter_items = []
            var items = this.filter_list.getStore().data.items;
            for(i=0; i < items.length; i++) {
                filter_items.push(items[i].data);
            }

            // build settings object
            var config = {};
            config['filter_list'] = filter_items;
            config['delay_time'] = this.delayTime.getValue();
            config['default_stop_time'] = this.defaultStoptime.getValue();
            config['default_minimum_stop_ratio'] = this.defaultMinRatio.getValue();
            deluge.client.seedtime.set_config(config);
        }
    },

    onOk: function() {
        this.onApply();
    },

    updateConfig: function() {
        deluge.client.seedtime.get_config({
            success: function(config) {
                this.filter_list.getStore().loadData(config['filter_list']);
                this.delayTime.setValue(config['delay_time']);
                this.defaultStoptime.setValue(config['default_stop_time']);
                this.defaultMinRatio.setValue(config['default_minimum_stop_ratio']);
                this.hasReadConfig = true;
            },
            scope: this
        });
    }
});

Deluge.ux.CustomSeedtimeWindow = Ext.extend(Ext.Window, {

    title: _('Custom Stop Time'),
    width: 300,
    height: 100,

    initComponent: function() {
        Deluge.ux.CustomSeedtimeWindow.superclass.initComponent.call(this);
        this.addButton(_('Cancel'), this.onCancelClick, this);
        this.addButton(_('Ok'), this.onOkClick, this);

        this.form = this.add({
            xtype: 'form',
            height: 35,
            baseCls: 'x-plain',
            bodyStyle:'padding:5px 5px 0',
            defaultType: 'numberfield',
            labelWidth: 220,
            items: [{
                    fieldLabel: _('Stop Time (Days)'),
                    name: 'stoptime',
                    allowBlank: false,
                    maxValue : 365.0,
                    minValue : 0.00,
                    decimalPrecision : 2,
                    width: 50,
                    listeners: {
                        'specialkey': {
                            fn: function(field, e) {
                                if (e.getKey() == 13) this.onOkClick();
                            },
                            scope: this
                        }
                    }
                },
                {
                  fieldLabel : _('Minimum ratio'),
                  name : 'stop_ratio',
                  allowBlank: false,
                  maxValue : 999,
                  minValue : 0,
                  decimalPrecision : 2,
                  width : 50,
                },
                {
                  xtype: 'checkbox',
                  fieldLabel : _('Remove torrent'),
                  name : 'remove_torrent',
                },
                {
                  xtype: 'checkbox',
                  fieldLabel : _('Remove data'),
                  name : 'remove_data',
                },
            ]
        });
    },

    onCancelClick: function() {
        this.hide();
    },

    onOkClick: function() {
        this.item.stoptime = this.form.getForm().findField('stoptime').getValue();
        this.item.stopratio = this.form.getForm().findField('stop_ratio').getValue();
        this.item.removetorrent = this.form.getForm().findField('remove_torrent').getValue();
        this.item.removedata = this.form.getForm().findField('remove_data').getValue();
        this.setStoptime(this.item, this.e)
        this.hide();
    },

    onHide: function(comp) {
        Deluge.ux.CustomSeedtimeWindow.superclass.onHide.call(this, comp);
        this.form.getForm().reset();
    },

    onShow: function(comp) {
        Deluge.ux.CustomSeedtimeWindow.superclass.onShow.call(this, comp);
        this.form.getForm().findField('stoptime').focus(false, 150);
    }
});

SeedTimePlugin = Ext.extend(Deluge.Plugin, {

    name: 'SeedTime',

    createMenu: function() {
        menuTimes = [1, 2, 3, 7, 14, 30],
        itemslist = [{  text: _('Never'),
                        stoptime : 0,
                        stopratio : 0,
                        removetorrent : false,
                        removedata : false,
                        handler: this.setStoptime,
                        scope: this
                }];
        for(indx=0; indx < menuTimes.length; indx++) {
            itemslist.push({  text: _(menuTimes[indx] + ' Days'),
                        stoptime : menuTimes[indx],
                        stopratio : 0,
                        removetorrent : false,
                        removedata : false,
                        handler: this.setStoptime,
                        scope: this
                    });
        }
        itemslist.push({text: _('Custom'),
                        stoptime : 1,
                        stopratio : 0,
                        removetorrent : false,
                        removedata : false,
                        handler: this.setCustomStoptime,
                        scope: this
                        });
        this.torrentMenu = new Ext.menu.Menu({items: itemslist});
    },

    setStoptime: function(item, e) {
        var ids = deluge.torrents.getSelectedIds();
        Ext.each(ids, function(id, i) {
            if (ids.length == i + 1) {
                deluge.client.seedtime.set_torrent(id, item.stoptime, item.stopratio,
                                                   item.removetorrent, item.removedata, {
                    success: function() {
                        deluge.ui.update();
                    }
                });
            } else {
                deluge.client.seedtime.set_torrent(id, item.stoptime, item.stopratio,
                                                   item.removetorrent, item.removedata);
            }
        });
    },

    setCustomStoptime: function(item, e) {
        if (!this.customTimeWindow) {
            this.customTimeWindow = new Deluge.ux.CustomSeedtimeWindow();
            this.customTimeWindow.setStoptime = this.setStoptime;
        }
        this.customTimeWindow.item = item;
        this.customTimeWindow.e = e;
        this.customTimeWindow.show();
    },

    onDisable: function() {
        deluge.preferences.removePage(this.prefsPage);
        deluge.menus.torrent.remove(this.tmSep);
        deluge.menus.torrent.remove(this.tm);
        this.deregisterTorrentStatus('seeding_time');
        this.deregisterTorrentStatus('seed_stop_time');
        this.deregisterTorrentStatus('seed_time_remaining');
        this.deregisterTorrentStatus('seed_min_ratio');
    },

    onEnable: function() {
        //preference page
        this.prefsPage = deluge.preferences.addPage(new Deluge.ux.preferences.SeedTimePage());

        //context menu
        this.createMenu();
        this.tmSep = deluge.menus.torrent.add({
            xtype: 'menuseparator'
        });
        this.tm = deluge.menus.torrent.add({
            text: _('Seed Stop Time'),
            menu: this.torrentMenu
        });

        ftimewithnull = function(n) {
                if(n==null) {return "";}
                else if(n == 0) {n=0.1} // avoid 0 being infinite
                return Deluge.Formatters.timeRemaining(n);
            };
        // status columns
        this.registerTorrentStatus('seeding_time', _('Seed Time'),
            { colCfg : { sortable : true, renderer : ftimewithnull}});
        this.registerTorrentStatus('seed_stop_time', _('Stop Seed Time'),
            { colCfg : { sortable : true, renderer : ftimewithnull}});
        this.registerTorrentStatus('seed_time_remaining', _('Remaining Seed Time'),
            { colCfg : { sortable : true, renderer : ftimewithnull}});
        this.registerTorrentStatus('seed_min_ratio', _('Seed Min Ratio'),
            { colCfg : { sortable : true,
                renderer : function(r){return r.toPrecision(2)}}});
    }
});
Deluge.registerPlugin('SeedTime', SeedTimePlugin);
