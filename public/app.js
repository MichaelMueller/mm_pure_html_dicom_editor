///
/// Basic data updating and event mechanism
///  
class App
{
    ///
    /// @return this
    ///  
    constructor()
    {
        this._delimiter = "/";
        ///
        /// @var object
        ///
        this._data = {};
    }
    ///
    /// @return string
    ///  
    delimiter()
    {
        return this._delimiter;
    }
    ///        
    /// @param object changes
    /// @return this
    ///  
    update( changes ) 
    {
        return this._update( changes, true );
    }
    ///        
    /// @param string path
    /// @return mixed|null
    ///  
    get( path )
    {
        if( path == null )
            path = "";

        let keys = path == "" ? [] : String(path).split(this._delimiter);

        // recursively get the value
        let curr_object = this._data;
        while( keys.length > 0 )
        {
            let key = keys.shift();
            if( typeof curr_object != "object" || !( key in curr_object ) )
                return null;
            curr_object = curr_object[key];
        }

        // filter the object if necessary
        return this._filter_on_get( path, App.deep_copy( curr_object ) );
    }
    ///        
    /// @param string path
    /// @param mixed value
    /// @return this
    ///  
    set( path, value )
    {
        return this._set( path, value, true );
    }
    ///        
    /// @param string path
    /// @param mixed value
    /// @param bool validate
    /// @return this
    ///  
    _set( path, value, validate=false )
    {
        if( path == null )
            path = "";

        let keys = String(path).split(this._delimiter);

        // recursively build a change object
        let changes = {};
        let curr_object = changes;
        while( keys.length > 0 )
        {
            let key = keys.shift();
            if( keys.length == 0 )
                curr_object[key] = value;
            else
            {
                curr_object[key] = {};
                curr_object = curr_object[key];
            }
        }
        return this._update( changes, validate );
    }
    ///        
    /// @param object changes
    /// @param bool validate
    /// @return this
    ///  
    _update( changes, validate=false ) 
    {
        let updated_items = {};
        let prev_items = {};
        let parent_path = null;

        this._recursive_update( changes, validate, this._data, updated_items, prev_items, parent_path );        
        this._on_updated( updated_items, prev_items );
    }
    ///        
    /// @param object changes
    /// @param bool validate
    /// @param object target
    /// @param object updated_items
    /// @param object prev_items
    /// @param string|null parent_path
    /// @return this
    ///  
    _recursive_update( changes, validate, target, updated_items, prev_items, parent_path ) 
    {
        // first level checks
        if( changes == null || typeof changes != "object" )
        {
            console.error("changes must be a map-like object or array, not "+String(changes));
            return false;
        }
        // prev_values will have the same structure as the changes
        let keys = Object.keys(changes);
        let changed = false;
        for( let key of keys )
        {
            let curr_path = ( parent_path == null ? "" : parent_path + this._delimiter ) + String(key);
            // use filter if needed
            let updated_value = this._filter_on_update( curr_path, changes[key], true );
            let curr_value = key in target ? target[key] : null;
            if( validate && this._is_valid(curr_path, updated_value, curr_value) == false )
                continue;
            
            // validation passed, now apply the value
            updated_items[curr_path] = updated_value;
            prev_items[curr_path] = curr_value;   
            if( updated_value != null && ["Array", "Object"].includes(updated_value.constructor.name) )
            {                
                let child_changes = updated_value;
                if( curr_value == null || curr_value.constructor.name != child_changes.constructor.name )                
                    target[key] = child_changes.constructor.name == "Array" ? [] : {};
                let child_target = target[key];

                let child_changed = this._recursive_update( child_changes, validate, child_target, updated_items, prev_items, curr_path );
                if( child_changed == false )
                {
                    delete updated_items[curr_path];
                    delete prev_items[curr_path];
                }
                changed = changed || child_changed;
            }
            else            
            {
                target[key] = updated_value;
                if( target[key] == null )
                {
                    if( Array.isArray( target ) )
                        target.remove( key );
                    else
                        delete target[key];
                }
                changed = true;
            } 
        }
        return changed;
    }
    ///
    /// @param string path
    /// @param mixed value
    /// @return void
    ///  
    _filter_on_update( path, value ) { return value; }
    ///
    /// @param string path
    /// @param mixed value
    /// @return void
    ///  
    _filter_on_get( path, value ) { return value; }
    ///
    /// @param object changes
    /// @param object curr_value
    /// @return bool
    ///  
    _is_valid( path, updated_value, curr_value ) { return true; }
    ///
    /// @param object updated_items all changes as path -> value items
    /// @param object prev_values
    /// @return void
    ///  
    _on_updated( updated_items, prev_items ) {}
    ///
    /// @param object object
    /// @return object
    ///  
    static deep_copy( obj )
    {        
        if( obj != null && typeof obj == "object" )
        {
            let copy = Array.isArray(obj) ? [] : {};
            for( let key in obj )
                copy[key] = App.deep_copy( obj[key] );
            return copy;                        
        }
        else
            return obj;
    }
}
///
/// Mirrors changes to the DOM and vice versa
///  
class HtmlApp extends App
{
    ///
    /// @return this
    ///  
    constructor()
    {
        super();
        this._dom_loaded = false;
        this._cached_updates = [];
        this._cached_validation_flags = [];
        this._active_element = null;
        this._init();
    }
    ///
    /// @return void
    ///  
    _init()
    {            
        document.addEventListener("DOMContentLoaded", function(event) 
        {               
            this._dom_loaded = true;  

            document.addEventListener("change", function(event) 
            { 
                let elem = event.target;
                if( "bindValue" in elem.dataset )
                {
                    let path = elem.getAttribute("name");
                    let value = null;
                    if( elem.tagName.toLowerCase() == "input" && elem.getAttribute("type").toLowerCase() == "file" )
                    {
                        path = "bindFiles" in elem.dataset ? elem.dataset.bindFiles : path;
                        value = event.target.files;
                    }                        
                    else if("options" in event.target)
                    {
                        const selectedValues = [];
                        for (let i = 0; i < event.target.options.length; i++)                             
                            if (event.target.options[i].selected)                                 
                                selectedValues.push(event.target.options[i].value);
                        value = selectedValues;
                    }
                    else
                        value = event.target.value;
                    this._active_element = elem;
                    this.set( path, value );
                    this._active_element = null;
                }

            }.bind(this));

            // apply cache
            for( let i=0; i<this._cached_updates.length; ++i )
                this._update( this._cached_updates[i], this._cached_validation_flags[i] );

            this._cached_updates = null;
            this._cached_validation_flags = null;
        }.bind(this));
    }
    ///        
    /// @param object changes
    /// @param bool validate
    /// @return this
    ///  
    _update( changes, validate=false ) 
    {
        if(this._dom_loaded == false)
        {
            this._cached_updates.push( App.deep_copy( changes ) );
            this._cached_validation_flags.push( validate );
            return this;
        }
        else
            return super._update( changes, validate );
    }
    ///
    /// @param object updated_items all changes as path -> value items
    /// @param object prev_values
    /// @return void
    ///  
    _on_updated( updated_items, prev_items ) 
    {
        let updated_paths = Object.keys(updated_items);
        //updated_paths.reverse();
        for( let path of updated_paths )
        {
            let value = updated_items[path];
            //let prev_value = updated_items[path];
            // get the value
            let bool_value = value == null ? false : Boolean(value);
            let str_value = value == null ? "" : String(value);
            if( Array.isArray(value) && value.length == 0 )
                bool_value = false;
            else if( value != null && typeof value == "object" && Object.keys(value).length == 0 )
                bool_value = false;

            let elements = null;
            // bind whole object to elements
            if( value != null && typeof value == "object" )
            {                  
                let child_object = value;      
                elements = document.querySelectorAll(`[data-bind-object="${path}"]`);
                for( let i=0; i < elements.length; ++ i)
                {                    
                    let elem = elements.item(i);
                    if( elem.children.length == 0 )
                    {
                        console.error("A template element at index 0 is needed for element with path "+`[data-bind-object="${path}"]`);
                        continue;
                    }
                    let first_child = elem.children[0];
                    first_child.style.display = "none";
                    let first_child_html = new XMLSerializer().serializeToString(first_child);
                    first_child_html = first_child_html.replaceAll(' xmlns="http://www.w3.org/1999/xhtml"', '');
                    
                    elem.innerHTML = first_child_html;
                    for( let key in child_object )
                    {
                        if( child_object[key] == null )
                            continue;
                        let item_elem_html = first_child_html.replaceAll('$key$', key);
                        item_elem_html = item_elem_html.replaceAll('display: none;', "");
                        item_elem_html = item_elem_html.replaceAll(' style=""', "");
                        elem.innerHTML += item_elem_html;
                    }
                }  
            }

            // bind value to form elements
            elements = document.querySelectorAll(`[name="${path}"][data-bind-value]`);
            for( let i=0; i < elements.length; ++ i)
            {
                let elem = elements.item(i);
                if( elem != this._active_element && ( elem.getAttribute("type") != "file" || str_value == "") )
                    elem.value = str_value;    
            }

            // bind html content
            elements = document.querySelectorAll(`[data-bind-html="${path}"]`);
            for( let i=0; i < elements.length; ++ i)
            {
                let elem = elements.item(i);
                elem.innerHTML = str_value;    
                if( "htmlSuffix" in elem.dataset )
                    elem.innerHTML += elem.dataset.htmlSuffix;             
            }

            // bind css display property
            elements = document.querySelectorAll(`[data-bind-display="${path}"]`);
            for( let i=0; i < elements.length; ++ i)
            {
                let elem = elements.item(i);
                let display_type = "displayFlex" in elem.dataset ? "flex" : "block";
                elem.style.display = ("bindDisplayInvert" in elem.dataset ? ! bool_value : bool_value) ? display_type : "none";                        
            }

            // bind css visibility property
            elements = document.querySelectorAll(`[data-bind-visibility="${path}"]`);
            for( let i=0; i < elements.length; ++ i)
            {
                let elem = elements.item(i);
                elem.style.visibility = ("bindVisibilityInvert" in elem.dataset ? ! bool_value : bool_value) ? "visible" : "hidden";                        
            }

            // bind css classes to an element
            elements = document.querySelectorAll(`[data-bind-css-class="${path}"]`);
            for( let i=0; i < elements.length; ++ i)
            {
                let elem = elements.item(i);
                let cssClass = elem.dataset.cssClass;
                if( bool_value )
                    elem.classList.add(cssClass);              
                else
                    elem.classList.remove(cssClass);
            }
        }        
    }
    
}