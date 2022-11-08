class Validator
{
    constructor()
    {
        this._errors = {};
    }

    check_function( var_name, value, nullable ) { return this.check_type(var_name, value, nullable, "Function") }
    check_type( var_name, value, nullable, constructor_name )
    {
        let is_valid = ( Boolean(nullable) == true && value == null ) || ( value != null && value.constructor.name == String(constructor_name) );
        if( is_valid == false )
            this._errors[var_name] = this._build_expected_value_error( String(constructor_name) );
        return this;
    }

    has_error( var_name )
    {
        return var_name in this._errors;
    }

    print_errors_if_any()
    {
        this.ok();
    }
    ok( errors=null )
    {
        // check whether to print errors or not
        let print_errors = typeof errors != "object";

        // print errors if needed
        if(Object.keys( this._errors ).length > 0 )
        {
            if( print_errors )
            {
                let error = null;
                for( let var_name in errors )
                    error = (error == null ? "" : error+"\n") + `"${var_name}: ` + errors[var_name];
                console.error( error );   
            }         
            else 
                Object.assign( errors, this._errors );
            this._errors = {};
            return false;
        }
        return true;
    }

    failed( errors = null ) { return ! this.ok( errors ); }

    _build_expected_value_error( var_name, expected_value_description, value )
    {
        return `"${var_name}": Expected ${expected_value_description}, not "${value}:${typeof value}"`;
    }
}

///
/// Basic building block of applications 
///  
class Node
{
    ///
    /// @return this
    ///  
    constructor( init_callback=null, validate_callback=null, changed_callback=null )
    {
        // @var object
        this._items = null;

        this.set_items({
            "init_callback": init_callback,
            "validate_callback": validate_callback,
            "changed_callback": changed_callback
        })
    }
    set_parent( parent, name_in_parent )
    {
        // exchange of the parent will happen in changed()
        this.set_items({ "parent": parent, "name_in_parent": name_in_parent });       
    }
    ///
    /// @return Node|null
    ///  
    parent() { return this.get("parent") }
    ///
    /// @return string|null
    ///  
    name() { return this.get("name_in_parent"); }
    ///
    /// @return string
    ///  
    root() { return this._root_and_path()[0] }
    ///
    /// @return string
    ///  
    path() { return this._root_and_path()[1] }
    add(...items) { return this.set_items( ...items ); }
    set( key, value ) { return this.set_items({[key]: value}) };
    ///
    /// @param object items
    /// @param object|null errors
    /// @return this
    ///  
    set_items( items, errors=null )
    {
        if( typeof items != "object" )
            items = [items];
        
        if( Array.isArray(items) )
        {
            let items_as_object = {};
            let next_key = this.keys().length;
            for( let item of items )
            {
                while( this.has( next_key ) )
                    ++next_key;
                items_as_object[next_key] = item;
                ++next_key;
            }
            items = items_as_object;
        }
        
        // set the items
        let prev_values = {};
        for( let key in items )
        {                
            prev_values = key in this._items ? this._items[key] : null;
            this._items[key] = items[key];
        }    

        return this;
    }
    keys()
    {
        return Object.keys( this._items );
    }
    has(key)
    {
        return key in this._items; 
    }
    get(key)
    {
        return key in this._items ? this._items[key] : null;
    }
    ///
    /// @return array
    ///  
    _root_and_path()
    {
        let parent = this._parent;
        let name = this._name;
        let names = [];
        while(parent)
        {
            names.push( name );
            if( parent.parent() != null )
            {
                name = parent.name();
                parent = parent.parent();
            }
            else
            {                
                names.reverse();
                return [ parent, names.join(".") ];
            }
        }
        return [null, null];
    }
}