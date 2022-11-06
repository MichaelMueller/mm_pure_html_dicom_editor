///
/// Basic building block of applications 
///  
class Node
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
        Node.assert( typeof changes == "object", `expected typeof 'changes' == "object", got ${String(changes)}:${typeof changes}`);
        return this._update( changes, true );
    }
    ///        
    /// @param string path
    /// @return mixed|null
    ///  
    get( path )
    {
        if( this._on_access(path) == false )
            return null;

        let keys = String(path).split(".");
        let curr_object = this._data;
        while( keys.length > 0 )
        {
            let key = keys.shift();
            if( typeof curr_object != "object" || !( key in curr_object ) )
                return null;
            curr_object = curr_object[key];
        }
        if( typeof curr_object == "object" )
        {
            let deep_copy = function deep_copy( obj )
            {
                if( typeof obj == "object" )
                {
                    let copy = Array.isArray(obj) ? [] : {};
                    for( let key in obj )
                        copy[key] = deep_copy( obj[key] );
                    return copy;                        
                }
                else
                    return obj;
            }
            return deep_copy( curr_object );
        }
        return curr_object;
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
        let prev_values = {};
        let errors = {};

        // reset errors
        if( validate )
            this._set( "errors", null, false );

        this._recursive_update( changes, validate, this._data, prev_values, errors, null );

        // set errors
        if( Object.keys(errors).length > 0 )
            this._update( {"errors": errors} );
        
        if( Object.keys(changes).length > 0 )
            this._on_updated( changes, prev_values );
    }
    ///        
    /// @param object changes
    /// @param bool validate
    /// @param object target
    /// @param object prev_values
    /// @param object errors
    /// @param string|null parent_path
    /// @return this
    ///  
    _recursive_update( changes, validate, target, prev_values, errors, parent_path=null ) 
    {
        let keys = Object.keys(changes);
        for( let key of keys )
        {
            let curr_path = ( parent_path ? parent_path + "." : "" ) + String(key);
            // use filter here
            let value = this._filter( curr_path, changes[key] );
            let curr_value = key in target ? target[key] : null;
            // check if we need validation
            if( validate )
            {
                let expected_value = this._validate( curr_path, value, curr_value );
                if( expected_value !== null )
                {
                    errors[curr_path] = expected_value;
                    delete changes[key];
                    continue;
                }
            }

            // validation passed apply the value
            target[key] = changes[key];
            prev_values[key] = curr_value;
        }
    }
    ///        
    /// @param string path
    /// @param mixed value
    /// @return mixed
    ///  
    _filter( path, value ) { return value; }
    ///        
    /// @param string path
    /// @param mixed value
    /// @param mixed curr_value
    /// @return null|string description of the expected value
    ///  
    _validate( path, value, curr_value ) { return null; }
    ///
    /// @param string path
    /// @return bool
    ///  
    _on_access( path ) { return true; }
    ///
    /// @param object changes
    /// @param object prev_value
    /// @return void
    ///  
    _on_updated( changes, prev_values ) {}
    ///
    /// @param bool condition
    /// @param string error_message
    /// @return bool
    ///  
    static assert( condition, error_message )
    {
        if( Boolean(condition) === false )
        {
            console.error( String(error_message) );
            return false;
        }
        return true;
    }
}
