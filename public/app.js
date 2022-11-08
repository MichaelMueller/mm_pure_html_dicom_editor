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
        ///
        /// @var object
        ///
        this._data = {};
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
        // recursively get the value
        let keys = String(path).split(".");
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
        // convert to changes object       
        let keys = String(path).split(".");
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
            let curr_path = ( parent_path ? parent_path + "." : "" ) + String(key);
            // use filter if needed
            let updated_value = this._filter_on_update( curr_path, changes[key], true );
            let curr_value = key in target ? target[key] : null;
            if( validate && this._is_valid(curr_path, updated_value, curr_value) == false )
                continue
            
            // validation passed, now apply the value
            if( updated_value != null && typeof updated_value == "object" )
            {                
                let child_changes = updated_value;
                if( curr_value == null || curr_value.constructor.name != child_changes.constructor.name )                
                    target[key] = child_changes.constructor.name == "Array" ? [] : {};
                let child_target = target[key];

                changed = this._recursive_update( child_changes, validate, child_target, updated_items, prev_items, curr_path );
                if( changed )
                    prev_items[curr_path] = child_target;
            }
            else            
            {
                target[key] = updated_value;
                changed = true;
            }  
            // if nothing was changed do not add     
            if( changed )
            {
                updated_items[curr_path] = updated_value;
                prev_items[curr_path] = curr_value;   
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
                copy[key] = deep_copy( obj[key] );
            return copy;                        
        }
        else
            return obj;
    }
}
///
/// Mirrors changes to the DOM and vice versa
///  
class HtmlApp
{

}