///
/// Basic data updating and event mechanism
///  
class App
{
    ///
    /// @return this
    ///  
    constructor(delimiter=null)
    {
        this._delimiter = typeof delimiter == "string" ? delimiter : "/";
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
    get( path, default_value=null )
    {
        let delimiter = this._delimiter;
        if( path == null || path == delimiter )
            path = "";

        let keys = path == "" ? [] : String(path).split(delimiter);

        // recursively get the value
        let curr_object = this._data;
        for(let i=0; i<keys.length; ++i)
        {
            let key = keys[i];
            if( typeof curr_object != "object" || !( key in curr_object ) )
                return default_value;
            curr_object = curr_object[key];
        }

        // filter the object if necessary
        return this._filter_on_get( keys, this._deep_copy( curr_object ) );
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
        let delimiter = this._delimiter;
        if( path == null || path == delimiter )
            path = "";

        let keys = String(path).split(delimiter);

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
        // first level checks
        if( changes == null || typeof changes != "object" )
        {
            console.error("changes must be an object or array, not "+String(changes));
            return this;
        }
        // filter
        this._filter_changes( changes );
        // validate
        if( validate && this._validate(changes) == false )
            return this;
        // apply
        this._recursive_update( changes, this._data ); 
        this._on_updated( changes );
    }
    ///        
    /// @param object changes
    /// @param object target
    /// @return void
    ///  
    _recursive_update( changes, target ) 
    {
        // these keys will be removed if they are null
        let keys_to_remove = [];

        // iterate
        for( let key in changes )
        {
            // use filter if needed
            let updated_value = changes[key];
            
            // recursive case if we got an array or object (map)
            if( updated_value != null && ["Array", "Object"].includes(updated_value.constructor.name) )
            {                
                let child_changes = updated_value;
                // change the value in the target to the same data structure (also a change)
                if( !( key in target && target[key].constructor.name == child_changes.constructor.name ) )               
                    target[key] = child_changes.constructor.name == "Array" ? [] : {};
                // dive deeper
                let child_target = target[key];    
                this._recursive_update( child_changes, child_target );
            }
            else            
            {
                target[key] = updated_value;
                // if we got a new value, cache this. We need to remove the nulls once we have
                // iterated the changes. removing this nulls right now would invalidate the changes!!
                if( updated_value == null )
                    keys_to_remove.push( key );
            }             
        }
        // remove nulls from the target
        for( let key of keys_to_remove )
        {
            if( Array.isArray( target ) )
                target.remove( key );
            else
                delete target[key];
        }
    }
    ///
    /// @param object changes
    /// @param mixed value
    /// @return void
    ///  
    _filter_changes( changes ) {}
    ///
    /// @param string path
    /// @param mixed value
    /// @return void
    ///  
    _filter_on_get( keys, value ) { return value; }
    ///
    /// @param object changes
    /// @return bool
    ///  
    _validate( changes ) { return true; }
    ///
    /// @param object changes
    /// @return void
    ///  
    _on_updated( changes ) {}
    ///
    /// @param array keys
    /// @param array target_keys
    /// @return bool
    ///  
    _keys_equal( keys, target_keys) { return keys.length === target_keys.length && keys.every(function(value, index) { return value === target_keys[index]}) }
    ///
    /// @param object object
    /// @return object
    ///  
    _deep_copy( obj )
    {        
        if( obj != null && typeof obj == "object" )
        {
            let copy = Array.isArray(obj) ? [] : {};
            for( let key in obj )
                copy[key] = this._deep_copy( obj[key] );
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
    constructor(delimiter=null)
    {
        super(delimiter);
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
            this._cached_updates.push( this._deep_copy( changes ) );
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
    _on_updated( changes ) 
    {
        this._update_dom( changes, null );
    }
    ///
    /// @param object changes
    /// @param string parent_path
    /// @return void
    ///  
    _update_dom( changes, parent_path )
    {        
        //updated_paths.reverse();
        for( let key in changes )
        {
            let path = (parent_path == null ? "" : parent_path + this._delimiter) + String(key);
            let value = changes[key];
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
                    let first_child = null;
                    for( let j=0; j < elem.children.length; ++j )
                    {
                        let child_elem = elem.children[j];
                        if( j == 0 )
                        {
                            first_child = child_elem;
                            first_child.style.display = "none";
                        }
                        else
                        {
                            let key = "key" in child_elem.dataset ? child_elem.dataset.key : null;
                        }
                    }

                    if( elem.children.length == 0 )
                    {
                        console.error("A template element at index 0 is needed for element with path "+`[data-bind-object="${path}"]`);
                        continue;
                    }
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
                this._update_dom( value, path );
            }

            // bind value to form elements
            elements = document.querySelectorAll(`[name="${path}"][data-exist]`);
            for( let i=0; i < elements.length; ++ i)
            {
                let elem = elements.item(i);
                if( bool_value == false )
                    elem.remove();
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