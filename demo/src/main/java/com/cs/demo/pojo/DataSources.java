package com.cs.demo.pojo;

import java.util.List;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement(name = "datasources")
@XmlAccessorType (XmlAccessType.FIELD)
public class DataSources {

	@XmlElement(name = "datasource")
	private List<DataSource> datasource;

	public List<DataSource> getDatasource() {
		return datasource;
	}

	public void setDatasource(List<DataSource> datasource) {
		this.datasource = datasource;
	}
	
	
}
